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

## Seed

`seed.sql` inserts demo wards, potholes, badges, and timeline events — all fictional.

## Storage

Configure the `spot-photos` bucket via migration `20260101000003_spot_photos_storage.sql` (user-scoped write paths, public read).
