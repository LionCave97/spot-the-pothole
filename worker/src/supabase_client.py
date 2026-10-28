"""Supabase Storage + Postgres updates via REST (service role)."""

from __future__ import annotations

from typing import Any

import httpx

from .config import Settings


class SupabaseClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._base = settings.supabase_url
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        }

    async def download_quarantine(self, path: str) -> bytes:
        url = f"{self._base}/storage/v1/object/{self._settings.quarantine_bucket}/{path}"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return resp.content

    async def upload_published(self, path: str, body: bytes) -> None:
        url = f"{self._base}/storage/v1/object/{self._settings.published_bucket}/{path}"
        headers = {
            **self._headers,
            "Content-Type": "image/jpeg",
            "x-upsert": "false",
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, content=body)
            if resp.status_code == 409:
                # Idempotent: already published at this path.
                return
            resp.raise_for_status()

    async def delete_quarantine(self, path: str) -> None:
        url = f"{self._base}/storage/v1/object/{self._settings.quarantine_bucket}/{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.delete(url, headers=self._headers)
            if resp.status_code in (200, 204, 404):
                return
            resp.raise_for_status()

    async def get_report(self, report_id: str) -> dict[str, Any] | None:
        params = {
            "id": f"eq.{report_id}",
            "select": "id,pothole_id,photo_path,photo_moderation_status,published_photo_path,reporter_id",
            "limit": "1",
        }
        url = f"{self._base}/rest/v1/reports"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers, params=params)
            resp.raise_for_status()
            rows = resp.json()
            return rows[0] if rows else None

    async def find_report_by_photo_path(self, photo_path: str) -> dict[str, Any] | None:
        params = {
            "photo_path": f"eq.{photo_path}",
            "select": "id,pothole_id,photo_moderation_status,published_photo_path,reporter_id",
            "limit": "1",
        }
        url = f"{self._base}/rest/v1/reports"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers, params=params)
            resp.raise_for_status()
            rows = resp.json()
            return rows[0] if rows else None

    async def update_report_published(
        self, report_id: str, published_path: str
    ) -> None:
        url = f"{self._base}/rest/v1/reports"
        params = {"id": f"eq.{report_id}"}
        body = {
            "photo_moderation_status": "published",
            "published_photo_path": published_path,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.patch(
                url, headers={**self._headers, "Prefer": "return=minimal"}, params=params, json=body
            )
            resp.raise_for_status()

    async def update_pothole_photo(self, pothole_id: str, published_path: str) -> None:
        url = f"{self._base}/rest/v1/potholes"
        params = {"id": f"eq.{pothole_id}"}
        body = {"photo_path": published_path}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.patch(
                url, headers={**self._headers, "Prefer": "return=minimal"}, params=params, json=body
            )
            resp.raise_for_status()
