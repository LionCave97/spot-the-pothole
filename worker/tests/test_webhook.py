import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.config import Settings
from src.main import app
from src.pipeline import ProcessOutcome


@pytest.fixture
def client(monkeypatch):
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service-key",
        webhook_secret="test-secret",
    )
    import src.main as main_mod

    main_mod.settings = settings
    main_mod.supabase = AsyncMock()
    return TestClient(app)


def test_webhook_rejects_bad_secret(client):
    resp = client.post("/webhook/storage", json={"record": {}})
    assert resp.status_code == 401


def test_storage_webhook_wrong_bucket(client):
    payload = {
        "type": "INSERT",
        "record": {"bucket_id": "other", "name": "u/p.jpg"},
    }
    resp = client.post(
        "/webhook/storage",
        json=payload,
        headers={"X-Webhook-Secret": "test-secret"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"


def test_report_webhook_calls_pipeline(client):
    payload = {
        "type": "INSERT",
        "record": {
            "id": "r1",
            "photo_path": "user/photo.jpg",
            "photo_moderation_status": "pending",
            "published_photo_path": None,
        },
    }
    with patch("src.main.process_quarantine_photo", new_callable=AsyncMock) as proc:
        proc.return_value = ProcessOutcome("published", "ok", report_id="r1")
        resp = client.post(
            "/webhook/report",
            json=payload,
            headers={"X-Webhook-Secret": "test-secret"},
        )
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"
    proc.assert_awaited_once()


def test_verify_webhook_secret_bearer():
    from src.webhook import verify_webhook_secret

    assert verify_webhook_secret(None, "s", authorization="Bearer s")
    assert not verify_webhook_secret("wrong", "s")
