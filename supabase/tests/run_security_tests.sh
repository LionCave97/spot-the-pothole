#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

for test_file in "$ROOT"/security_tests/*_test.sql; do
  echo "Running $(basename "$test_file")..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$test_file"
done
