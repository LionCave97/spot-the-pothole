/** Live spot capture thresholds (Phase 1). Keep mobile/web logic in sync with these values. */

/** Block capture when GPS speed exceeds this (km/h). */
export const SPOT_CAPTURE_MAX_SPEED_KMH = 10

/** Block capture when horizontal accuracy is worse than this (metres). */
export const SPOT_CAPTURE_MAX_GPS_ACCURACY_METERS = 35

/** Minimum interval between location samples used for speed (ms). */
export const SPOT_CAPTURE_LOCATION_MIN_INTERVAL_MS = 500
