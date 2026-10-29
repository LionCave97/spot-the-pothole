#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec python download_fixtures.py
