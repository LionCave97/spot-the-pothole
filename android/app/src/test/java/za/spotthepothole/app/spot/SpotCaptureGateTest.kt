package za.spotthepothole.app.spot

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SpotCaptureGateTest {
    @Test
    fun blocksHighSpeed() {
        val result = SpotCaptureGate.evaluate(
            SpotLocationSample(
                lat = -26.0,
                lng = 28.0,
                accuracyMeters = 8f,
                speedMps = 4f,
                capturedAtIso = "2026-01-01T00:00:00Z",
            ),
        )
        assertFalse(result.allowed)
        assertEquals(SpotCaptureBlockReason.SPEED, result.reason)
    }

    @Test
    fun allowsWhenStopped() {
        val result = SpotCaptureGate.evaluate(
            SpotLocationSample(
                lat = -26.0,
                lng = 28.0,
                accuracyMeters = 8f,
                speedMps = 0f,
                capturedAtIso = "2026-01-01T00:00:00Z",
            ),
        )
        assertTrue(result.allowed)
    }
}
