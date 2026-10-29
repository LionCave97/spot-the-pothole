#!/usr/bin/env python3
"""Download blur-worker eval images from manifest (open licenses only)."""

from __future__ import annotations

import json
import pathlib
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
MANIFEST = ROOT / "manifest.json"
OUT = ROOT / "images"


def fetch_bytes(url: str) -> bytes:
    visited: list[str] = []

    class LoopSafeRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            if newurl in visited or req.full_url == newurl:
                return None
            visited.append(newurl)
            return urllib.request.Request(
                newurl,
                headers=req.headers,
                method=req.get_method(),
            )

    opener = urllib.request.build_opener(LoopSafeRedirect())
    req = urllib.request.Request(url, headers={"User-Agent": "SpotThePothole-eval/1.0"})
    with opener.open(req, timeout=120) as resp:
        return resp.read()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    data = json.loads(MANIFEST.read_text())
    for img in data["images"]:
        dest = OUT / f"{img['id']}.jpg"
        if dest.exists() and dest.stat().st_size > 0:
            continue
        url = img["downloadUrl"]
        print(f"Fetching {img['id']}...")
        for attempt in range(8):
            try:
                dest.write_bytes(fetch_bytes(url))
                time.sleep(1.25)
                break
            except urllib.error.HTTPError as err:
                if err.code in (429, 503) and attempt < 7:
                    time.sleep(min(90, 2 ** (attempt + 2)))
                    continue
                raise
    print(f"Images in {OUT}")


if __name__ == "__main__":
    main()
