# Server photo blur (Vercel WASM)

Authoritative **second-pass blur** for quarantine uploads: YuNet (faces) + LPD-YuNet (plate regions) via **ONNX Runtime Web (WASM SIMD)** on `POST /api/internal/blur`, then publish EXIF-stripped JPEGs to `spot-photos`. The quarantine original is deleted only after a blurred copy is stored and the report row is updated — **never** publish the unblurred quarantine object.

## Architecture

| Piece | Role |
|--------|------|
| `web/server/lib/blur/*` | Detect, NMS (pure TS OpenCV Rect semantics), Sharp blur |
| `web/server/api/internal/blur.post.ts` | Webhook handler (storage + report payloads) |
| `claim_photo_blur_report` RPC | Atomic `UPDATE … WHERE pending` claim + attempt counter |
| Supabase Database Webhooks | Trigger blur after quarantine upload / report insert |

### Fallback (container)

If WASM latency, memory, or bundle limits become blocking, the same webhook contract can target a **CPU container** running OpenCV DNN + the same Zoo ONNX models (YuNet / LPD-YuNet) on **Cloud Run** or **Fly.io**. Keep one shared `BLUR_WEBHOOK_SECRET` and identical JSON payloads; only the base URL changes.

## Quarantine triggers (no secrets in git)

Configure in Supabase (values from **Vault** or project secrets — never commit):

1. **Storage webhook** — table `storage.objects`, events `INSERT` (and optional `UPDATE`), filter `bucket_id = 'spot-photos-quarantine'`.  
   URL: `https://<your-nuxt-host>/api/internal/blur`  
   Header: `X-Webhook-Secret: <BLUR_WEBHOOK_SECRET>` (or `Authorization: Bearer …`).

2. **Report webhook** — table `public.reports`, event `INSERT`, filter `photo_moderation_status = 'pending'`.  
   Same URL and secret. Ensures processing runs after `POST /api/game/spot` links the row.

Optional: enable the commented **`pg_net`** pattern in migration `20260101000008_photo_blur_queue.sql` once `blur_webhook_url` and Vault secret are set in the database.

Env (see `web/.env.example`): `BLUR_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, bucket overrides.

## Idempotency & retries

- **`photo_blur_attempt_count`** / **`photo_blur_processing_at`** / **`photo_blur_last_error`** on `reports` (migration above).
- **`claim_photo_blur_report`** increments attempts and sets a **10-minute lock**; concurrent webhooks get **`202`** (`status: retry`).
- Failures release the lock and leave **`photo_moderation_status = pending`** for retry until **5 attempts**, then **`max_attempts_exceeded`** for DEV-212 moderation.
- Already **`published`** rows are skipped; duplicate storage events are safe.

## Bundle & runtime (Oct 2026 VM)

| Metric | Typical |
|--------|---------|
| `.vercel/output/functions` | **~59 MB** (under 250 MB limit) |
| Cold start (models load) | **~6.5 s** |
| 30-fixture detect median (warm sessions) | **~4.5 s** |

Measure: `cd web && node ./scripts/measure-blur-spike.mjs` (downloads models, Vercel build).

## Detection parity

- **NMS unit test:** `cd web && npm run blur:test-nms` (builds cv2 golden cases at test time via `nms-golden-provider.py`).
- **End-to-end counts:** `fixtures/blur-worker-eval/detection-counts-baseline.json` + `npm run blur:compare` (images downloaded locally, not committed).

## Key commands

```bash
cd web && npm run blur:models
cd web && npm test
cd ../fixtures/blur-worker-eval && ./download-fixtures.sh
cd ../../web && npm run blur:compare
```

Eval manifest notes: `docs/blur-worker-eval.md`.
