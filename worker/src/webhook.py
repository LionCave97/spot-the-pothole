"""Parse Supabase Database Webhooks and verify shared secret."""

from __future__ import annotations

import hmac
import json
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class StorageObjectEvent:
    bucket_id: str
    object_path: str
    event_type: str


@dataclass(frozen=True)
class ReportEvent:
    report_id: str
    photo_path: str
    moderation_status: str
    published_photo_path: str | None


def verify_webhook_secret(
    provided: str | None, expected: str, *, authorization: str | None = None
) -> bool:
    """Accept `X-Webhook-Secret`, `Authorization: Bearer`, or raw body HMAC (optional)."""
    if provided and hmac.compare_digest(provided.strip(), expected):
        return True
    if authorization:
        prefix = "Bearer "
        if authorization.startswith(prefix):
            token = authorization[len(prefix) :].strip()
            if hmac.compare_digest(token, expected):
                return True
    return False


def parse_storage_webhook(payload: dict[str, Any]) -> StorageObjectEvent | None:
    """Supabase DB webhook on `storage.objects` INSERT/UPDATE."""
    record = payload.get("record") or {}
    bucket_id = record.get("bucket_id") or record.get("bucketId")
    name = record.get("name") or record.get("path")
    if not bucket_id or not name:
        return None
    event_type = str(payload.get("type") or payload.get("eventType") or "INSERT").upper()
    return StorageObjectEvent(str(bucket_id), str(name), event_type)


def parse_report_webhook(payload: dict[str, Any]) -> ReportEvent | None:
    record = payload.get("record") or {}
    report_id = record.get("id")
    photo_path = record.get("photo_path")
    if not report_id or not photo_path:
        return None
    status = str(record.get("photo_moderation_status") or "pending")
    published = record.get("published_photo_path")
    return ReportEvent(str(report_id), str(photo_path), status, published)


def parse_json_body(raw: bytes) -> dict[str, Any]:
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))
