"""End-to-end quarantine → blur → publish pipeline."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np

from .blur import apply_privacy_blur, encode_exif_free_jpeg
from .config import Settings
from .detect import detect_regions
from .supabase_client import SupabaseClient

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProcessOutcome:
    status: str  # published | pending | skipped | deferred
    reason: str
    report_id: str | None = None
    published_path: str | None = None


def _published_storage_path(user_id: str, quarantine_path: str) -> str:
    file_name = quarantine_path.split("/")[-1]
    return f"{user_id}/{file_name}"


def _should_publish(detections, settings: Settings, blur_min_score: float | None) -> tuple[bool, str]:
    if blur_min_score is not None and blur_min_score < settings.publish_min_score:
        return False, "low_confidence_detection"
    for det in detections:
        threshold = (
            settings.face_blur_min_score if det.label == "face" else settings.plate_blur_min_score
        )
        if det.score >= threshold and det.score < settings.publish_min_score:
            return False, "low_confidence_detection"
    return True, "ok"


async def process_quarantine_photo(
    supabase: SupabaseClient,
    settings: Settings,
    quarantine_path: str,
    *,
    report_id: str | None = None,
) -> ProcessOutcome:
    if ".." in quarantine_path or quarantine_path.startswith("/"):
        return ProcessOutcome("skipped", "invalid_path")

    parts = quarantine_path.split("/")
    if len(parts) < 2:
        return ProcessOutcome("skipped", "invalid_path")
    user_id = parts[0]

    if report_id:
        report = await supabase.get_report(report_id)
        if report and str(report.get("photo_path")) != quarantine_path:
            report = None
    else:
        report = await supabase.find_report_by_photo_path(quarantine_path)

    if report is None:
        return ProcessOutcome("deferred", "report_not_found_yet")

    if report.get("photo_moderation_status") == "published" and report.get("published_photo_path"):
        return ProcessOutcome(
            "skipped",
            "already_published",
            report_id=str(report["id"]),
            published_path=str(report["published_photo_path"]),
        )

    try:
        raw = await supabase.download_quarantine(quarantine_path)
        arr = np.frombuffer(raw, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            return ProcessOutcome("pending", "decode_failed", report_id=str(report["id"]))

        detections = detect_regions(image, settings.face_model_path, settings.plate_model_path)
        blur_result = apply_privacy_blur(
            image,
            detections,
            face_min_score=settings.face_blur_min_score,
            plate_min_score=settings.plate_blur_min_score,
            padding_ratio=settings.blur_padding_ratio,
        )

        ok, reason = _should_publish(detections, settings, blur_result.min_score_used)
        if not ok:
            logger.info("Leaving report pending: %s", reason)
            return ProcessOutcome("pending", reason, report_id=str(report["id"]))

        published_path = _published_storage_path(user_id, quarantine_path)
        jpeg_bytes = encode_exif_free_jpeg(blur_result.image_bgr, quality=settings.jpeg_quality)

        await supabase.upload_published(published_path, jpeg_bytes)
        await supabase.update_report_published(str(report["id"]), published_path)
        await supabase.update_pothole_photo(str(report["pothole_id"]), published_path)
        await supabase.delete_quarantine(quarantine_path)

        return ProcessOutcome(
            "published",
            "ok",
            report_id=str(report["id"]),
            published_path=published_path,
        )
    except Exception as exc:  # noqa: BLE001 — worker must not crash webhook delivery
        logger.exception("Processing failed: %s", exc)
        return ProcessOutcome("pending", "error", report_id=str(report["id"]))
