import {
  SPOT_CAPTURE_MAX_GPS_ACCURACY_METERS,
  SPOT_CAPTURE_MAX_SPEED_KMH,
} from './constants.ts'

export type SpotCaptureBlockReason = 'speed' | 'accuracy' | 'no_location'

export interface SpotLocationSample {
  lat: number
  lng: number
  /** Horizontal accuracy in metres (lower is better). */
  accuracyMeters: number
  /** Speed in m/s from the location provider, if available. */
  speedMps: number | null
  capturedAt: string
}

export interface SpotCaptureGateResult {
  allowed: boolean
  reason: SpotCaptureBlockReason | null
  location: SpotLocationSample | null
}

function speedKmhFromMps(speedMps: number | null): number | null {
  if (speedMps == null || Number.isNaN(speedMps) || speedMps < 0) {
    return null
  }
  return speedMps * 3.6
}

/**
 * Returns whether a live spot photo may be taken at the current location fix.
 */
export function evaluateSpotCaptureGate(
  location: SpotLocationSample | null,
): SpotCaptureGateResult {
  if (!location) {
    return { allowed: false, reason: 'no_location', location: null }
  }

  if (
    !Number.isFinite(location.accuracyMeters)
    || location.accuracyMeters <= 0
    || location.accuracyMeters > SPOT_CAPTURE_MAX_GPS_ACCURACY_METERS
  ) {
    return { allowed: false, reason: 'accuracy', location }
  }

  const speedKmh = speedKmhFromMps(location.speedMps)
  if (speedKmh != null && speedKmh > SPOT_CAPTURE_MAX_SPEED_KMH) {
    return { allowed: false, reason: 'speed', location }
  }

  return { allowed: true, reason: null, location }
}
