"""Gaussian blur for detected privacy regions."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image

from .detect import Detection


@dataclass(frozen=True)
class BlurResult:
    image_bgr: np.ndarray
    blurred_face_count: int
    blurred_plate_count: int
    min_score_used: float | None


def _pad_box(
    x: int, y: int, w: int, h: int, img_w: int, img_h: int, padding_ratio: float
) -> tuple[int, int, int, int]:
    pad_x = int(w * padding_ratio)
    pad_y = int(h * padding_ratio)
    x0 = max(0, x - pad_x)
    y0 = max(0, y - pad_y)
    x1 = min(img_w, x + w + pad_x)
    y1 = min(img_h, y + h + pad_y)
    return x0, y0, x1 - x0, y1 - y0


def apply_privacy_blur(
    image_bgr: np.ndarray,
    detections: list[Detection],
    *,
    face_min_score: float,
    plate_min_score: float,
    padding_ratio: float = 0.12,
) -> BlurResult:
    out = image_bgr.copy()
    h, w = out.shape[:2]
    face_count = 0
    plate_count = 0
    min_score: float | None = None

    for det in detections:
        threshold = face_min_score if det.label == "face" else plate_min_score
        if det.score < threshold:
            continue
        if min_score is None or det.score < min_score:
            min_score = det.score
        x, y, bw, bh = _pad_box(det.x, det.y, det.w, det.h, w, h, padding_ratio)
        roi = out[y : y + bh, x : x + bw]
        if roi.size == 0:
            continue
        k = max(15, (min(bw, bh) // 2) | 1)
        blurred = cv2.GaussianBlur(roi, (k, k), 0)
        out[y : y + bh, x : x + bw] = blurred
        if det.label == "face":
            face_count += 1
        else:
            plate_count += 1

    return BlurResult(out, face_count, plate_count, min_score)


def encode_exif_free_jpeg(image_bgr: np.ndarray, quality: int = 82) -> bytes:
    """Write JPEG without EXIF/metadata (PIL strips ancillary chunks)."""
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)
    from io import BytesIO

    buf = BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()
