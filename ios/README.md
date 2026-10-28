# SpotThePothole iOS

SwiftUI skeleton generated from `project.yml` via [XcodeGen](https://github.com/yonaskolb/XcodeGen).

## Generate Xcode project (on macOS)

```bash
brew install xcodegen
cd ios
xcodegen generate
open SpotThePothole.xcodeproj
```

## Configuration

Copy `.env.example` values into build settings or a local `Config.xcconfig` (gitignored). Apps talk to Supabase for auth/reads/uploads and call Nuxt server routes under `/api/game/*` for scoring and moderation.

## Screens (stub)

- Map
- Spot (camera)
- Pothole detail (navigate programmatically in future)
- Leaderboard
- Profile
