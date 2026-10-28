# Spot the Pothole — Android

Kotlin + Jetpack Compose skeleton. UI strings mirror `shared/strings/en.json` (manual subset until codegen).

## Build

```bash
cp local.properties.example local.properties
# Edit sdk.dir to your Android SDK

./gradlew assembleDebug
```

Configure Supabase and web API via Gradle properties (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WEB_API_BASE`) — see `.env.example`.

## Architecture notes

- **Supabase:** auth, reads, photo uploads (stubbed)
- **Nuxt `/api/game/*`:** spot, confirm, merge, moderation (stub HTTP client)

Screens: Map, Spot, Pothole detail, Leaderboard, Profile.
