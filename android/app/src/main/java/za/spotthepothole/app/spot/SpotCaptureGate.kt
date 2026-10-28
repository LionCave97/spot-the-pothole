package za.spotthepothole.app.spot

data class SpotLocationSample(
    val lat: Double,
    val lng: Double,
    val accuracyMeters: Float,
    val speedMps: Float?,
    val capturedAtIso: String,
)

enum class SpotCaptureBlockReason {
    NO_LOCATION,
    ACCURACY,
    SPEED,
}

data class SpotCaptureGateResult(
    val allowed: Boolean,
    val reason: SpotCaptureBlockReason?,
    val location: SpotLocationSample?,
)

object SpotCaptureGate {
    fun evaluate(location: SpotLocationSample?): SpotCaptureGateResult {
        if (location == null) {
            return SpotCaptureGateResult(false, SpotCaptureBlockReason.NO_LOCATION, null)
        }

        if (
            !location.accuracyMeters.isFinite()
            || location.accuracyMeters <= 0f
            || location.accuracyMeters > SpotCaptureConstants.MAX_GPS_ACCURACY_METERS
        ) {
            return SpotCaptureGateResult(false, SpotCaptureBlockReason.ACCURACY, location)
        }

        val speedKmh = location.speedMps?.takeIf { it >= 0f }?.times(3.6f)
        if (speedKmh != null && speedKmh > SpotCaptureConstants.MAX_SPEED_KMH) {
            return SpotCaptureGateResult(false, SpotCaptureBlockReason.SPEED, location)
        }

        return SpotCaptureGateResult(true, null, location)
    }
}
