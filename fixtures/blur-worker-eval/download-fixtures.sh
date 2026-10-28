#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 download_fixtures.py
