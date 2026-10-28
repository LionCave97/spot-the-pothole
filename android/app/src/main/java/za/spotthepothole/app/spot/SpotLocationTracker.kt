package za.spotthepothole.app.spot

import android.annotation.SuppressLint
import android.content.Context
import android.os.Looper
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.time.Instant

class SpotLocationTracker(context: Context) {
    private val fusedClient = LocationServices.getFusedLocationProviderClient(context)
    private var callback: LocationCallback? = null

    var latest: SpotLocationSample? = null
        private set

    @SuppressLint("MissingPermission")
    fun start(onUpdate: (SpotLocationSample) -> Unit) {
        stop()
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L)
            .setMinUpdateIntervalMillis(500L)
            .build()

        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return
                val sample = SpotLocationSample(
                    lat = loc.latitude,
                    lng = loc.longitude,
                    accuracyMeters = loc.accuracy,
                    speedMps = if (loc.hasSpeed()) loc.speed else null,
                    capturedAtIso = Instant.ofEpochMilli(loc.time).toString(),
                )
                latest = sample
                onUpdate(sample)
            }
        }
        callback = locationCallback
        fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
    }

    fun stop() {
        callback?.let { fusedClient.removeLocationUpdates(it) }
        callback = null
    }
}
