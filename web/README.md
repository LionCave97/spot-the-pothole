# Spot the Pothole — web (Nuxt 4)

Public site and **server routes** under `/api/game/*` for scoring, duplicate merge, and moderation orchestration. Uses Supabase for auth and data; game actions use the service role on the server only.

## Prerequisites

- Node.js 22+ (matches CI)
- Local Supabase stack (see repo root `README.md` and `supabase/README.md`)

## Setup

```bash
cp .env.example .env
# Fill from `supabase status` (never commit real keys)

npm ci
npm run dev    # http://localhost:3000
```

### Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `NUXT_PUBLIC_SUPABASE_URL` | Yes | Local default `http://127.0.0.1:54321` |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key from Supabase CLI |
| `SUPABASE_SERVICE_ROLE_KEY` | Server routes | Game merges / scoring only |

Placeholders are fine for `npm run build` in CI.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

## Architecture notes

- Shared strings and types live in `../shared/`.
- Server route stubs: `server/api/game/`.
- Do not expose the service role key to the client bundle.

## Related packages

- `../shared/` — constants, types, schemas
- `../supabase/` — migrations and seed data
