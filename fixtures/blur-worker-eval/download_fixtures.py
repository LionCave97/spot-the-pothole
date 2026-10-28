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


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    data = json.loads(MANIFEST.read_text())
    for img in data["images"]:
        dest = OUT / f"{img['id']}.jpg"
        if dest.exists() and dest.stat().st_size > 0:
            continue
        url = img["downloadUrl"]
        print(f"Fetching {img['id']}...")
        req = urllib.request.Request(url, headers={"User-Agent": "SpotThePothole-eval/1.0"})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=120) as resp:
                    dest.write_bytes(resp.read())
                break
            except urllib.error.HTTPError as err:
                if err.code == 429 and attempt < 4:
                    time.sleep(2 ** attempt)
                    continue
                raise
    print(f"Images in {OUT}")


if __name__ == "__main__":
    main()
