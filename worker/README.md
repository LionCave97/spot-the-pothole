# Spot photo blur worker (DEV-211)

CPU-only container that blurs faces (YuNet) and number plates (LPD-YuNet) on quarantine uploads, publishes EXIF-free JPEGs to `spot-photos`, updates moderation fields, and deletes the quarantine original.

**Does not deploy itself** — build and run locally or on your chosen host (Cloud Run Johannesburg, Fly.io `jnb`, etc.).

## Models

See [MODELS.md](./MODELS.md). ONNX files are downloaded at Docker build time with pinned SHA-256 checksums.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | yes | Project URL (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role key (storage + REST) |
| `WEBHOOK_SECRET` | yes | Shared secret verified on each webhook |
| `PORT` | no | Default `8080` |
| `FACE_BLUR_MIN_SCORE` | no | Default `0.55` |
| `PLATE_BLUR_MIN_SCORE` | no | Default `0.45` |
| `PUBLISH_MIN_SCORE` | no | Below this → leave report `pending` (DEV-212 queue) |

Never commit secrets; inject via host env or secret manager.

## Build

```bash
cd worker
docker build -t spot-blur-worker .
```

## Run locally

```bash
docker run --rm -p 8080:8080 \
  -e SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="..." \
  -e WEBHOOK_SECRET="choose-a-long-random-string" \
  spot-blur-worker
```

Health: `GET http://localhost:8080/healthz`

## Wire Supabase Database Webhooks

Use **two** webhooks (recommended) so processing runs after both upload and report row exist:

### 1. Quarantine storage object created

1. Supabase Dashboard → **Database** → **Webhooks** → **Create a new hook**
2. Table: `storage.objects`, events: **Insert**
3. HTTP URL: `https://YOUR_WORKER/webhook/storage` (or `/webhook`)
4. HTTP headers: `X-Webhook-Secret: <same as WEBHOOK_SECRET>`
5. Optional filter (SQL): `bucket_id = 'spot-photos-quarantine'`

Payload is the standard Supabase change payload; the worker reads `record.bucket_id` and `record.name`.

If the report row is not created yet, the worker responds with `{ "status": "deferred", "reason": "report_not_found_yet" }`. Configure the hook to **retry** on non-2xx or add the report webhook below.

### 2. Report inserted (pending moderation)

1. Table: `public.reports`, events: **Insert**
2. URL: `https://YOUR_WORKER/webhook/report`
3. Same `X-Webhook-Secret` header
4. Filter: `photo_moderation_status = 'pending'`

This drives processing once `POST /api/game/spot` has linked the quarantine path.

### Manual / integration test

```bash
curl -sS -X POST http://localhost:8080/webhook/report \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{
    "type": "INSERT",
    "table": "reports",
    "schema": "public",
    "record": {
      "id": "00000000-0000-4000-8000-000000000001",
      "photo_path": "USER_UUID/photo.jpg",
      "photo_moderation_status": "pending",
      "published_photo_path": null
    }
  }'
```

## Hosting notes (not deployed in this PR)

| Option | Region | Rough cost (always-on minimal) |
|--------|--------|--------------------------------|
| **Fly.io** | `jnb` | ~$5–7/mo (shared-cpu 256MB) + egress |
| **Cloud Run** | `africa-south1` (Johannesburg) | Pay per request; ~$0 idle if min instances = 0; cold starts on webhook |

Cheapest for low spot volume: **Cloud Run** with min instances 0. For steady traffic or cold-start sensitivity, a small **Fly** machine in `jnb` is predictable.

## Tests

```bash
cd worker
pip install -r requirements.txt
./scripts/download_models.sh
PYTHONPATH=. pytest -q
```

Evaluation fixtures live in `../fixtures/blur-worker-eval/` (manifest + download script). See `../docs/blur-worker-eval.md`.
