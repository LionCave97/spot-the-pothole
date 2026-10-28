"""HTTP server for Supabase webhooks."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, Request

from .config import Settings, load_settings
from .pipeline import process_quarantine_photo
from .supabase_client import SupabaseClient
from .webhook import (
    parse_json_body,
    parse_report_webhook,
    parse_storage_webhook,
    verify_webhook_secret,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings: Settings | None = None
supabase: SupabaseClient | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global settings, supabase
    settings = load_settings()
    supabase = SupabaseClient(settings)
    yield


app = FastAPI(title="Spot photo blur worker", lifespan=lifespan)


@app.get("/healthz")
async def healthz():
    return {"ok": True}


def _auth_or_401(
    x_webhook_secret: str | None, authorization: str | None
) -> None:
    assert settings is not None
    if not verify_webhook_secret(
        x_webhook_secret, settings.webhook_secret, authorization=authorization
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")


@app.post("/webhook/storage")
async def webhook_storage(
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
):
    _auth_or_401(x_webhook_secret, authorization)
    assert supabase is not None and settings is not None
    payload = parse_json_body(await request.body())
    event = parse_storage_webhook(payload)
    if event is None:
        raise HTTPException(status_code=400, detail="Unrecognized storage payload")
    if event.bucket_id != settings.quarantine_bucket:
        return {"status": "ignored", "reason": "wrong_bucket"}
    if event.event_type not in ("INSERT", "UPDATE"):
        return {"status": "ignored", "reason": event.event_type}

    outcome = await process_quarantine_photo(supabase, settings, event.object_path)
    return outcome.__dict__


@app.post("/webhook/report")
async def webhook_report(
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
):
    _auth_or_401(x_webhook_secret, authorization)
    assert supabase is not None and settings is not None
    payload = parse_json_body(await request.body())
    event = parse_report_webhook(payload)
    if event is None:
        raise HTTPException(status_code=400, detail="Unrecognized report payload")
    if event.moderation_status != "pending":
        return {"status": "ignored", "reason": "not_pending"}
    if event.published_photo_path:
        return {"status": "skipped", "reason": "already_published"}

    outcome = await process_quarantine_photo(
        supabase, settings, event.photo_path, report_id=event.report_id
    )
    return outcome.__dict__


@app.post("/webhook")
async def webhook_generic(
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
):
    """Route storage or report payloads on a single URL."""
    _auth_or_401(x_webhook_secret, authorization)
    assert supabase is not None and settings is not None
    payload = parse_json_body(await request.body())
    storage = parse_storage_webhook(payload)
    if storage and storage.bucket_id == settings.quarantine_bucket:
        outcome = await process_quarantine_photo(supabase, settings, storage.object_path)
        return outcome.__dict__
    report = parse_report_webhook(payload)
    if report:
        outcome = await process_quarantine_photo(
            supabase, settings, report.photo_path, report_id=report.report_id
        )
        return outcome.__dict__
    raise HTTPException(status_code=400, detail="Unrecognized payload")
