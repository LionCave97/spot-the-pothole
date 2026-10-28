# Shared package (`@spot-the-pothole/shared`)

Cross-platform contracts for Spot the Pothole: UI strings, TypeScript types, JSON request schemas, and domain constants.

## Layout

| Path | Purpose |
|------|---------|
| `strings/en.json` | English copy (Phase 1 single locale) |
| `types/index.ts` | API and domain TypeScript types |
| `constants.ts` | Merge radius, capture gates, pothole status literals |
| `schemas/` | JSON Schema for game API request bodies |

## Constants

`constants.ts` is the source of truth for values that must match across web, Android, iOS, and documented SQL defaults:

- **Merge radius:** `POTHOL_MERGE_RADIUS_METERS` (15 m) — Postgres functions use the same default.
- **Capture gates:** max speed ~10 km/h, GPS accuracy limit, location sample interval.
- **Status enums:** `POTHOL_STATUS` aligns with `PotholeStatus` in `types/index.ts`.

A follow-up capture module in `shared/capture/` (DEV-201) may re-export capture thresholds; keep numeric values identical to `constants.ts`.

## Consumption

- **Web (Nuxt):** import types/constants via relative path or workspace alias as needed.
- **Mobile:** mirror constants in Kotlin/Swift (see `android/.../DomainConstants.kt` and `ios/.../DomainConstants.swift`) until a codegen pipeline exists.

## Tests

Web or Node tests can import `./constants.ts` directly. Database behaviour is validated in CI via `supabase db reset` and optional `supabase/tests/*.sql`.
