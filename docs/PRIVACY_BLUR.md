# Privacy blur for spot photos

Spot photos may include bystanders or vehicle number plates. Mobile clients **must** run on-device face and plate detection, blur those regions, and upload **only** the blurred JPEG.

## On-device (required)

- **Android:** ML Kit face detection + text recognition (plate-shaped tokens), then region blur before upload.
- **iOS:** Vision face rectangles + text recognition with the same plate heuristics.

The unblurred capture buffer is discarded after processing; only the blurred bytes are uploaded to Supabase Storage.

Clients send `x-spot-blur-verified: on-device` on `POST /api/game/spot` after blur succeeds.

## Server fallback (Phase 1 behaviour)

If on-device blur fails, the app must **not** upload the original. The user sees a retry message.

The Nuxt `POST /api/game/spot` route rejects requests without the blur header (HTTP 422). This prevents unblurred uploads if a client is tampered with.

### Planned server-side fallback (not implemented)

A future edge function or background job can:

1. Pull the uploaded object from `spot-photos`.
2. Run a server-side detector (e.g. managed vision API).
3. Replace the object with a blurred variant or delete and flag the report.

Until that pipeline exists, operators should treat missing blur verification as a hard rejection (current behaviour).
