/**
 * Cross-platform domain constants (Phase 1).
 * Keep in sync with Postgres defaults (e.g. merge radius in game functions) and mobile shells.
 */

/** Default radius for duplicate pothole merge (matches SQL `pothole_merge_radius_meters` / `submit_spot`). */
export const POTHOL_MERGE_RADIUS_METERS = 15

/** Block live spot capture when GPS speed exceeds this (km/h). */
export const SPOT_CAPTURE_MAX_SPEED_KMH = 10

/** Block live spot capture when horizontal accuracy is worse than this (metres). */
export const SPOT_CAPTURE_MAX_GPS_ACCURACY_METERS = 35

/** Minimum interval between location samples used for speed (ms). */
export const SPOT_CAPTURE_LOCATION_MIN_INTERVAL_MS = 500

/** Pothole lifecycle values (matches `PotholeStatus` in `./types`). */
export const POTHOL_STATUS = {
  open: 'open',
  fixed: 'fixed',
  comeback: 'comeback',
} as const

export type PotholeStatusValue = (typeof POTHOL_STATUS)[keyof typeof POTHOL_STATUS]
