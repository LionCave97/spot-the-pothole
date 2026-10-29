# First production deploy (Leo — manual steps)

This repo does **not** auto-deploy. Wire hosted Supabase + Vercel yourself. No secrets in git.

## 1. Hosted Supabase

1. Create a project in the region nearest South Africa: **`af-south-1` (Cape Town)**.
2. From the repo root (Supabase CLI logged in):

   ```bash
   cd /path/to/spot-the-pothole
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   Applies migrations **`20260101000000`** through **`20260101000008`** (`000000`–`000008`).

3. **Do not** run `supabase db reset` on production. Skip `seed.sql` unless you want demo data only.

4. **Storage buckets** (also created by migration `000003`): `spot-photos-quarantine` (private), `spot-photos` (public read). Confirm both exist under **Storage** after push.

5. Copy from **Project Settings → API**: Project URL, `anon` key, `service_role` key (service role stays server-side only).

6. **Auth → URL configuration**
   - **Site URL:** `https://YOUR_VERCEL_DOMAIN` (production web URL).
   - **Redirect URLs:** `https://YOUR_VERCEL_DOMAIN/**` and `http://localhost:3000/**` (local dev).

## 2. Vercel (Nuxt `web/`)

1. Import the GitHub repo; set **Root Directory** to **`web`**.
2. **Framework:** Nuxt (auto). Build/install come from [`web/vercel.json`](../web/vercel.json):
   - **Install:** `npm ci` + `pip install onnx` (for blur model patching).
   - **Build:** `npm run blur:models && npm run build`
3. **Runtime:** Node.js (Nitro **vercel** preset). Function limits for `POST /api/internal/blur` are set in [`web/nuxt.config.ts`](../web/nuxt.config.ts) (Hobby: **2 GB / 300s max** with Fluid Compute).
4. Add **Environment Variables** (Production + Preview as needed) — see table below.

After the first deploy, note **`https://YOUR_VERCEL_DOMAIN`** for webhooks and mobile `WEB_API_BASE`.

## 3. Environment variables

| Variable | Set on | Value source |
|----------|--------|----------------|
| `NUXT_PUBLIC_SUPABASE_URL` | Vercel | Supabase → Settings → API → Project URL |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Supabase → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel only (secret) | Supabase → API → `service_role` (never in client/mobile) |
| `BLUR_WEBHOOK_SECRET` | Vercel + Supabase webhook headers | Generate a long random string; same value both places |
| `BLUR_QUARANTINE_BUCKET` | Vercel (optional) | Default `spot-photos-quarantine` |
| `BLUR_PUBLISHED_BUCKET` | Vercel (optional) | Default `spot-photos` |
| `NUXT_PUBLIC_MAP_TILE_URL` | Vercel (optional) | Default OSM tiles; override if you use a tile provider |
| `SUPABASE_URL` | Android Gradle / iOS `Config.xcconfig` | Same Project URL as above |
| `SUPABASE_ANON_KEY` | Android / iOS | Same `anon` key |
| `WEB_API_BASE` | Android / iOS | `https://YOUR_VERCEL_DOMAIN` (no trailing slash) |

Validate before deploy:

```bash
export NUXT_PUBLIC_SUPABASE_URL=... # etc.
node scripts/check-env.mjs --target=vercel
node scripts/check-env.mjs --target=mobile
```

Local web: copy [`web/.env.example`](../web/.env.example) → `web/.env`.

## 4. Quarantine → blur webhooks

Configure in **Supabase Dashboard → Database → Webhooks** (not in git). Use the shared secret (header **`X-Webhook-Secret`**, or `Authorization: Bearer …`).

**URL (both):** `https://YOUR_VERCEL_DOMAIN/api/internal/blur`

1. **Storage webhook** — table `storage.objects`, event **INSERT** (optional **UPDATE**), filter `bucket_id = 'spot-photos-quarantine'`.
2. **Report webhook** — table `public.reports`, event **INSERT**, filter `photo_moderation_status = 'pending'`.

Header on each webhook: `X-Webhook-Secret: <BLUR_WEBHOOK_SECRET>` (must match Vercel).

Optional later: enable the commented **`pg_net`** block in migration `20260101000008` and store `blur_webhook_url` + secret in **Supabase Vault** — Dashboard webhooks are enough for first deploy.

Details: [`docs/photo-blur.md`](photo-blur.md).

## 5. First moderator

After a user signs up (web or mobile):

```sql
-- Supabase SQL editor (service role context) or psql
update public.profiles
set is_moderator = true
where id = 'USER_UUID_FROM_AUTH_USERS';
```

Moderators use the web UI at `/admin/photos` (session + `is_moderator`).

## 6. Smoke-test checklist

- [ ] `node scripts/check-env.mjs --target=all` passes with your production exports.
- [ ] Web loads; sign-up / sign-in; complete onboarding (`/onboarding`).
- [ ] Map/feed/leaderboard load without console errors (tiles may be rate-limited on default OSM).
- [ ] Mobile (or curl) can reach `GET https://YOUR_VERCEL_DOMAIN/api/game/leaderboard`.
- [ ] Sign in on device; spot flow uploads JPEG to **quarantine**; `POST /api/game/spot` succeeds.
- [ ] Database webhooks fire; `POST /api/internal/blur` returns 200/202 (check Vercel **Logs**); report moves toward blur/moderation pipeline.
- [ ] Moderator can open `/admin/photos`, approve/reject a pending photo.
- [ ] Approved photo appears in public `spot-photos` and on feed/map.

If blur times out on cold start, retry webhook or see container fallback in [`docs/photo-blur.md`](photo-blur.md).
