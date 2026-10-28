"""Face (YuNet) and license plate (LPD-YuNet) region detection with multi-scale support."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .lpd_yunet import LPD_YuNet


@dataclass(frozen=True)
class Detection:
    x: int
    y: int
    w: int
    h: int
    score: float
    label: str  # "face" | "plate"


def _create_face_detector(model_path: str, input_size: tuple[int, int]) -> cv2.FaceDetectorYN:
    w, h = input_size
    detector = cv2.FaceDetectorYN.create(
        model_path,
        "",
        (w, h),
        score_threshold=0.3,
        nms_threshold=0.3,
        top_k=5000,
    )
    if detector is None:
        raise RuntimeError(f"Failed to load face model: {model_path}")
    return detector


def _run_face_pass(
    detector: cv2.FaceDetectorYN,
    image_bgr: np.ndarray,
    scale: float,
    offset: tuple[int, int],
) -> list[Detection]:
    h, w = image_bgr.shape[:2]
    detector.setInputSize((w, h))
    _, faces = detector.detect(image_bgr)
    out: list[Detection] = []
    if faces is None:
        return out
    ox, oy = offset
    inv = 1.0 / scale if scale != 1.0 else 1.0
    for row in faces:
        x, y, bw, bh, score = row[0], row[1], row[2], row[3], row[-1]
        gx = int((x * inv) + ox)
        gy = int((y * inv) + oy)
        gw = max(1, int(bw * inv))
        gh = max(1, int(bh * inv))
        out.append(Detection(gx, gy, gw, gh, float(score), "face"))
    return out


def _quad_to_aabb(det_row: np.ndarray) -> tuple[int, int, int, int, float]:
    xs = det_row[0:8:2]
    ys = det_row[1:8:2]
    score = float(det_row[-1])
    x0 = int(xs.min())
    y0 = int(ys.min())
    x1 = int(xs.max())
    y1 = int(ys.max())
    return x0, y0, max(1, x1 - x0), max(1, y1 - y0), score


def _run_plate_pass(
    detector: LPD_YuNet,
    image_bgr: np.ndarray,
    scale: float,
    offset: tuple[int, int],
) -> list[Detection]:
    h, w = image_bgr.shape[:2]
    target_w = max(320, int(w * scale))
    target_h = max(240, int(h * scale))
    resized = cv2.resize(image_bgr, (target_w, target_h), interpolation=cv2.INTER_AREA)
    detector.setInputSize(np.array([target_w, target_h], dtype=np.int32))
    dets = detector.infer(resized)
    ox, oy = offset
    inv = 1.0 / scale if scale != 1.0 else 1.0
    out: list[Detection] = []
    for row in dets:
        x, y, bw, bh, score = _quad_to_aabb(row)
        gx = int((x * inv) + ox)
        gy = int((y * inv) + oy)
        gw = max(1, int(bw * inv))
        gh = max(1, int(bh * inv))
        out.append(Detection(gx, gy, gw, gh, score, "plate"))
    return out


def _nms_detections(detections: list[Detection], iou_threshold: float = 0.45) -> list[Detection]:
    if not detections:
        return []
    boxes = [[d.x, d.y, d.x + d.w, d.y + d.h] for d in detections]
    scores = [d.score for d in detections]
    indices = cv2.dnn.NMSBoxes(boxes, scores, score_threshold=0.01, nms_threshold=iou_threshold)
    if len(indices) == 0:
        return []
    if isinstance(indices, np.ndarray):
        indices = indices.flatten().tolist()
    return [detections[i] for i in indices]


def _normalize_long_edge(image_bgr: np.ndarray, max_edge: int = 1920) -> tuple[np.ndarray, float]:
    h, w = image_bgr.shape[:2]
    long_edge = max(h, w)
    if long_edge <= max_edge:
        return image_bgr, 1.0
    scale = max_edge / long_edge
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(image_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA), scale


def detect_regions(
    image_bgr: np.ndarray,
    face_model_path: str,
    plate_model_path: str,
) -> list[Detection]:
    """Run face + plate detectors. Handles up to 1920px via full-res + half-scale passes."""
    if image_bgr.ndim != 3 or image_bgr.shape[2] != 3:
        raise ValueError("Expected BGR image")

    image_bgr, norm_scale = _normalize_long_edge(image_bgr, 1920)
    h, w = image_bgr.shape[:2]
    face_det = _create_face_detector(face_model_path, (w, h))
    plate_det = LPD_YuNet(
        modelPath=plate_model_path,
        confThreshold=0.55,
        nmsThreshold=0.3,
    )

    all_det: list[Detection] = []
    scales: list[tuple[float, tuple[int, int]]] = [(1.0, (0, 0))]
    if max(h, w) > 960:
        scales.append((0.5, (0, 0)))

    for scale, offset in scales:
        if scale == 1.0:
            img = image_bgr
        else:
            img = cv2.resize(image_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        all_det.extend(_run_face_pass(face_det, img, scale, offset))
        all_det.extend(_run_plate_pass(plate_det, img, scale, offset))

    if w >= 1600 and h >= 900:
        tile_w = w // 2
        for x0 in (0, tile_w):
            tile = image_bgr[:, x0 : x0 + tile_w]
            th, tw = tile.shape[:2]
            f_tile = _create_face_detector(face_model_path, (tw, th))
            all_det.extend(_run_face_pass(f_tile, tile, 1.0, (x0, 0)))
            all_det.extend(_run_plate_pass(plate_det, tile, 1.0, (x0, 0)))

    faces = _nms_detections([d for d in all_det if d.label == "face"])
    plates = _nms_detections([d for d in all_det if d.label == "plate"])
    combined = faces + plates
    if norm_scale == 1.0:
        return combined
    inv = 1.0 / norm_scale
    scaled: list[Detection] = []
    for d in combined:
        scaled.append(
            Detection(
                int(d.x * inv),
                int(d.y * inv),
                max(1, int(d.w * inv)),
                max(1, int(d.h * inv)),
                d.score,
                d.label,
            )
        )
    return scaled
