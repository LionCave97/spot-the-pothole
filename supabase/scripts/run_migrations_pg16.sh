#!/usr/bin/env bash
# Apply all supabase/migrations on plain PostgreSQL 16 + PostGIS (no supabase start).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${PG_TEST_DB:-spot_pothole_migrate_test}"
DB_USER="${PG_USER:-postgres}"
export PGHOST="${PGHOST:-}"
export PGPORT="${PGPORT:-5432}"

psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "drop database if exists ${DB_NAME};"
psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "create database ${DB_NAME};"

export DATABASE_URL="postgresql://${DB_USER}@${PGHOST}:${PGPORT}/${DB_NAME}"
export PGOPTIONS='-c search_path=public,extensions'

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/bootstrap_minimal_supabase.sql"

for f in "$ROOT"/migrations/*.sql; do
  echo "==> $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

if [[ -f "$ROOT/seed.sql" ]]; then
  echo "==> seed.sql"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/seed.sql"
fi

echo "==> security_hardening_test.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/security_tests/security_hardening_test.sql"

echo "==> photo_blur_claim_test.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/tests/photo_blur_claim_test.sql"

echo "OK: migrations + security + photo blur claim tests on ${DATABASE_URL}"
