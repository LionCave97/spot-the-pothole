# Roadmap

## Phase 1 (current scaffold)

- English UI strings in `shared/strings/en.json`
- Nuxt public site + `/api/game/*` server routes
- Supabase schema: PostGIS potholes, wards, reports, confirmations, timeline, badges, social, moderation
- Postgres functions: ~15 m duplicate merge, ward/authority lookup, points after 2 confirmations
- Android Compose + iOS SwiftUI skeletons (Map, Spot, Detail, Leaderboard, Profile)
- Fake seed data only; no secrets in git
- CI: web lint/build, Android Gradle assembleDebug

## Phase 2 (planned)

- **Languages:** 11 written languages (shared string pipeline + locale switching on web and mobile)
- **SASL** (South African Sign Language) support for core flows where feasible
- **Accessibility:** WCAG 2.2 AA audit and remediation
- **Passenger mode:** bump detection to suggest pothole reports while riding (privacy-first, opt-in)
- **Councillor claims:** verified ward councillor accounts and response commitments
- **Share cards:** social/share images for pothole fixes and ward score movement

## Phase 3+ (ideas, not committed)

- Open data exports for researchers and journalists
- API rate limits and abuse tooling beyond basic moderation flags
- Deep linking and universal links from share cards to pothole profiles
