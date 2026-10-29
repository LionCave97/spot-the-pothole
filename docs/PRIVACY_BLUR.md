# Privacy blur for spot photos

Spot photos may include bystanders or vehicle number plates. Privacy is enforced in **two layers** — the server never trusts client headers.

## Layer 1 — on-device (clients)

- **Android:** ML Kit face detection + text recognition (plate-shaped tokens), then region blur before upload.
- **iOS:** Vision face rectangles + text recognition with the same plate heuristics (`shared/plates/heuristic.ts`).

The unblurred capture buffer is discarded after processing. Clients upload the on-device-blurred JPEG to the **private quarantine bucket** only.

## Layer 2 — server (authoritative)

1. Mobile uploads to `spot-photos-quarantine/{userId}/…` (authenticated insert on own folder; **no public read**).
2. `POST /api/game/spot` references the quarantine path. The Nuxt route uses the **Supabase service role** to verify the object exists.
3. Phase 1 (Nuxt): verify quarantine object exists; store report with `photo_moderation_status = pending` and no public pothole photo until publish.
4. **Server blur (DEV-211):** Supabase Database Webhooks call **`POST /api/internal/blur`** on the Nuxt app (ONNX Runtime Web WASM on Vercel). See **`docs/photo-blur.md`**. Low confidence or repeated failures keep the report **`pending`** for DEV-212. Alternative: point the same webhook at a **Cloud Run / Fly** container running YuNet + LPD-YuNet if WASM limits bite.
5. Eval fixtures and metrics: `docs/blur-worker-eval.md`.

**Do not** send or check `x-spot-blur-verified` — tampered clients cannot skip server review.

## Buckets & RLS summary

| Bucket | Public | Client write | Client read | Server (service role) |
|--------|--------|--------------|-------------|------------------------|
| `spot-photos-quarantine` | no | insert own `{uid}/*` | own `{uid}/*` only | read/write all |
| `spot-photos` | yes | **none** | public read | read/write all (publish) |

All promotion from quarantine to public storage must use the service role (aligned with DEV-209 RPC/RLS hardening).

## Client failure modes

If on-device blur fails, the app must **not** upload. The user sees a retry message (`upload.blurFailed`).

If upload succeeds but moderation is pending, the UI can show `upload.pendingModeration` after spot submission.
