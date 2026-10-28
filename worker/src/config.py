"""Environment-driven configuration (no secrets in repo)."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    webhook_secret: str
    quarantine_bucket: str = "spot-photos-quarantine"
    published_bucket: str = "spot-photos"
    face_model_path: str = "/app/models/face_detection_yunet_2023mar.onnx"
    plate_model_path: str = "/app/models/license_plate_detection_lpd_yunet_2023mar.onnx"
    # YuNet score thresholds (OpenCV FaceDetectorYN confidence).
    face_blur_min_score: float = 0.55
    plate_blur_min_score: float = 0.55
    publish_min_score: float = 0.50
    blur_padding_ratio: float = 0.12
    jpeg_quality: int = 82
    host: str = "0.0.0.0"
    port: int = 8080


def load_settings() -> Settings:
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    secret = os.environ.get("WEBHOOK_SECRET", "").strip()
    if not url or not key or not secret:
        raise RuntimeError(
            "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and WEBHOOK_SECRET must be set"
        )
    return Settings(
        supabase_url=url.rstrip("/"),
        supabase_service_role_key=key,
        webhook_secret=secret,
        face_model_path=os.environ.get("FACE_MODEL_PATH", "/app/models/face_detection_yunet_2023mar.onnx"),
        plate_model_path=os.environ.get(
            "PLATE_MODEL_PATH", "/app/models/license_plate_detection_lpd_yunet_2023mar.onnx"
        ),
        face_blur_min_score=float(os.environ.get("FACE_BLUR_MIN_SCORE", "0.55")),
        plate_blur_min_score=float(os.environ.get("PLATE_BLUR_MIN_SCORE", "0.45")),
        publish_min_score=float(os.environ.get("PUBLISH_MIN_SCORE", "0.50")),
        port=int(os.environ.get("PORT", "8080")),
    )
