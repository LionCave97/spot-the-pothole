import numpy as np
import pytest

from src.blur import apply_privacy_blur, encode_exif_free_jpeg
from src.detect import Detection


def test_blur_masks_face_region():
    rng = np.random.default_rng(0)
    img = rng.integers(0, 256, (200, 200, 3), dtype=np.uint8)
    face = Detection(x=60, y=60, w=40, h=40, score=0.9, label="face")
    result = apply_privacy_blur(
        img, [face], face_min_score=0.55, plate_min_score=0.45, padding_ratio=0.1
    )
    assert result.blurred_face_count == 1
    diff = np.mean(np.abs(result.image_bgr.astype(np.float32) - img.astype(np.float32)))
    assert diff > 1.0


def test_blur_skips_low_score():
    img = np.full((100, 100, 3), 128, dtype=np.uint8)
    low = Detection(x=10, y=10, w=20, h=20, score=0.2, label="plate")
    result = apply_privacy_blur(
        img, [low], face_min_score=0.55, plate_min_score=0.45
    )
    assert result.blurred_plate_count == 0
    assert np.array_equal(result.image_bgr, img)


def test_jpeg_has_no_exif():
    img = np.full((64, 64, 3), 200, dtype=np.uint8)
    data = encode_exif_free_jpeg(img, quality=80)
    assert data.startswith(b"\xff\xd8")
    assert b"Exif" not in data[:32]
