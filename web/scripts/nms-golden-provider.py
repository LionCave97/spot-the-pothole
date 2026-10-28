#!/usr/bin/env python3
"""Build NMS golden cases at test time (cv2 reference). Requires opencv-python-headless + blur models."""
from __future__ import annotations

import json
import sys
from itertools import product
from pathlib import Path

import cv2 as cv
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
FIXTURES = ROOT / "fixtures" / "blur-worker-eval"
MODELS = WEB / "server" / "assets" / "blur-models"
FACE = MODELS / "face_detection_yunet_2023mar.onnx"
PLATE = MODELS / "license_plate_detection_lpd_yunet_2023mar.onnx"


def cv_nms(boxes, scores, score_threshold, nms_threshold, top_k=5000):
    keep = cv.dnn.NMSBoxes(boxes, scores, score_threshold, nms_threshold, 1.0, top_k)
    if keep is None or len(keep) == 0:
        return []
    arr = np.array(keep).reshape(-1)
    return [int(i) for i in arr.tolist()]


def case_from_cv(name, boxes, scores, score_threshold, nms_threshold, top_k=5000):
    return {
        "name": name,
        "boxes": boxes,
        "scores": scores,
        "score_threshold": score_threshold,
        "nms_threshold": nms_threshold,
        "top_k": top_k,
        "indices": cv_nms(boxes, scores, score_threshold, nms_threshold, top_k),
    }


def lpd_decode_all_boxes(resized_bgr, target_w, target_h, plate_path):
    net = cv.dnn.readNet(str(plate_path))
    blob = cv.dnn.blobFromImage(resized_bgr)
    net.setInput(blob)
    loc, conf, iou = net.forward(["loc", "conf", "iou"])

    min_sizes = [[10, 16, 24], [32, 48], [64, 96], [128, 192, 256]]
    steps = [8, 16, 32, 64]
    variance = [0.1, 0.2]
    iw, ih = target_w, target_h
    feature_map_2th = [int(int((ih + 1) / 2) / 2), int(int((iw + 1) / 2) / 2)]
    feature_map_3th = [int(feature_map_2th[0] / 2), int(feature_map_2th[1] / 2)]
    feature_map_4th = [int(feature_map_3th[0] / 2), int(feature_map_3th[1] / 2)]
    feature_map_5th = [int(feature_map_4th[0] / 2), int(feature_map_4th[1] / 2)]
    feature_map_6th = [int(feature_map_5th[0] / 2), int(feature_map_5th[1] / 2)]
    feature_maps = [feature_map_3th, feature_map_4th, feature_map_5th, feature_map_6th]
    priors = []
    for k, f in enumerate(feature_maps):
        for i, j in product(range(f[0]), range(f[1])):
            for min_size in min_sizes[k]:
                s_kx = min_size / iw
                s_ky = min_size / ih
                cx = (j + 0.5) * steps[k] / iw
                cy = (i + 0.5) * steps[k] / ih
                priors.append([cx, cy, s_kx, s_ky])
    priors = np.array(priors, dtype=np.float32)
    scale = np.array([target_w, target_h], dtype=np.float32)
    cls_scores = conf[:, 1]
    iou_scores = np.clip(iou[:, 0], 0.0, 1.0)
    scores = np.sqrt(cls_scores * iou_scores)
    bboxes = np.hstack(
        (
            (priors[:, 0:2] + loc[:, 4:6] * variance[0] * priors[:, 2:4]) * scale,
            (priors[:, 0:2] + loc[:, 6:8] * variance[0] * priors[:, 2:4]) * scale,
            (priors[:, 0:2] + loc[:, 10:12] * variance[0] * priors[:, 2:4]) * scale,
            (priors[:, 0:2] + loc[:, 12:14] * variance[0] * priors[:, 2:4]) * scale,
        )
    )
    return bboxes[:, 0:4].tolist(), scores.tolist()


def face_pre_nms_boxes(image_bgr, face_path):
    h, w = image_bgr.shape[:2]
    pad_w = int(np.floor((w - 1) / 32 + 1) * 32)
    pad_h = int(np.floor((h - 1) / 32 + 1) * 32)
    detector = cv.FaceDetectorYN.create(str(face_path), "", (pad_w, pad_h), 0.3, 0.3, 5000)
    detector.setInputSize((w, h))
    _, faces = detector.detect(image_bgr)
    if faces is None:
        return [], []
    boxes = []
    scores = []
    for row in faces:
        boxes.append([int(row[0]), int(row[1]), int(row[2]), int(row[3])])
        scores.append(float(row[-1]))
    return boxes, scores


def load_normalized(path: Path):
    arr = cv.imdecode(np.frombuffer(path.read_bytes(), dtype=np.uint8), cv.IMREAD_COLOR)
    long_edge = max(arr.shape[:2])
    if long_edge <= 1920:
        return arr
    scale = 1920 / long_edge
    nw, nh = int(arr.shape[1] * scale), int(arr.shape[0] * scale)
    return cv.resize(arr, (nw, nh), interpolation=cv.INTER_AREA)


def main() -> None:
    if not FACE.exists() or not PLATE.exists():
        print("Run: cd web && npm run blur:models", file=sys.stderr)
        sys.exit(2)

    cases = [
        case_from_cv(
            "synthetic_overlap",
            [[0, 0, 100, 100], [50, 50, 100, 100], [10, 10, 20, 20]],
            [0.9, 0.8, 0.7],
            0.5,
            0.3,
        ),
        case_from_cv(
            "lpd_top5_chain",
            [
                [-337.1153989434242, 89.19705086946487, -240.41002345085144, 386.4526244401932],
                [603.678191781044, 43.16334727406502, 542.0844330787659, 441.9019367694855],
                [1554.8336155414581, 16.34196710586548, 1580.4953110218048, 422.22361010313034],
                [1097.0717165470123, 69.19628709554672, 1045.544866323471, 431.33508986234665],
                [424.761354804039, 162.68147885799408, 444.82974803447723, 389.09399968385696],
            ],
            [0.8849452137947083, 0.8848798274993896, 0.8444665670394897, 0.8345929384231567, 0.7145851254463196],
            0.55,
            0.3,
        ),
        case_from_cv(
            "merge_style",
            [[-294, 50, 647, 461], [-80, 46, 938, 412], [1216, 11, 2120, 469]],
            [0.96, 0.92, 0.89],
            0.01,
            0.45,
        ),
    ]

    car_img = FIXTURES / "images" / "car-show-jhb.jpg"
    plate_img = FIXTURES / "images" / "plate-western-cape-02.jpg"
    if car_img.exists():
        img = load_normalized(car_img)
        boxes, scores = face_pre_nms_boxes(img, FACE)
        cases.append(case_from_cv("face_car_show", boxes, scores, 0.3, 0.3))
    if plate_img.exists():
        img = load_normalized(plate_img)
        h, w = img.shape[:2]
        target_w = max(320, w)
        target_h = max(240, h)
        resized = cv.resize(img, (target_w, target_h), interpolation=cv.INTER_AREA)
        boxes, scores = lpd_decode_all_boxes(resized, target_w, target_h, PLATE)
        cases.append(case_from_cv("lpd_western_cape_full", boxes, scores, 0.55, 0.3))

    json.dump(cases, sys.stdout)


if __name__ == "__main__":
    main()
