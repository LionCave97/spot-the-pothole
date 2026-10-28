# Supabase — Spot the Pothole

Local development uses the Supabase CLI. **Do not create or commit a hosted project from this scaffold.**

## Commands

```bash
supabase start
supabase db reset    # migrations + seed.sql
supabase status
```

## Migrations

1. `20260101000000_extensions_and_core.sql` — PostGIS, tables, profile trigger
2. `20260101000001_game_functions.sql` — ward lookup, merge within ~15 m, confirmations / points
3. `20260101000002_rls.sql` — RLS policies
4. `20260101000005_harden_rls_and_rpc_security.sql` — RPC hardening, masked `*_public` views, profile/pothole write restrictions

(`20260101000003_spot_photos_storage.sql` and `20260101000004_photo_moderation.sql` are in PR #2.)

## Security tests

```bash
supabase db reset
bash supabase/tests/run_security_tests.sh
```

## Seed

`seed.sql` inserts demo wards, potholes, badges, and timeline events — all fictional.

## Storage

Configure the `spot-photos` bucket via migration `20260101000003_spot_photos_storage.sql` (user-scoped write paths, public read).
