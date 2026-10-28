/** Spot photo upload limits (Phase 1). */

export const SPOT_PHOTO_MAX_BYTES = 1_500_000

export const SPOT_PHOTO_MAX_LONG_EDGE_PX = 1920

export const SPOT_PHOTO_JPEG_QUALITY = 0.82

export const SPOT_PHOTOS_QUARANTINE_BUCKET = 'spot-photos-quarantine'

export const SPOT_PHOTOS_PUBLISHED_BUCKET = 'spot-photos'

export type PhotoModerationStatus = 'pending' | 'published' | 'rejected'
