/** Spot photo upload limits (Phase 1). */

export const SPOT_PHOTO_MAX_BYTES = 1_500_000

export const SPOT_PHOTO_MAX_LONG_EDGE_PX = 1920

export const SPOT_PHOTO_JPEG_QUALITY = 0.82

/** Client header sent to `/api/game/spot` after on-device blur succeeds. */
export const SPOT_BLUR_VERIFIED_HEADER = 'x-spot-blur-verified'

export const SPOT_BLUR_VERIFIED_ON_DEVICE = 'on-device'
