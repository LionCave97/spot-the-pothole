package za.spotthepothole.app.ui.strings

/**
 * Phase 1: English strings mirrored from shared/strings/en.json (subset).
 * TODO: codegen from shared/strings in Phase 2 i18n work.
 */
data class AppStrings(
    val appName: String,
    val tagline: String,
    val navMap: String,
    val navSpot: String,
    val navLeaderboard: String,
    val navProfile: String,
    val mapTitle: String,
    val spotTitle: String,
    val spotCameraHint: String,
    val spotWaitingForGps: String,
    val spotSpeedTooFast: String,
    val spotGpsAccuracyPoor: String,
    val spotCaptureReady: String,
    val spotCapture: String,
    val spotCameraPermissionDenied: String,
    val profileTitle: String,
    val stubMessage: String,
    val errorsGeneric: String,
) {
    companion object {
        fun load() = AppStrings(
            appName = "Spot the Pothole",
            tagline = "Name it. Confirm it. Track the fix.",
            navMap = "Map",
            navSpot = "Spot",
            navLeaderboard = "Leaderboard",
            navProfile = "Profile",
            mapTitle = "Pothole map",
            spotTitle = "Spot a pothole",
            spotCameraHint = "Take a live photo at the pothole (GPS required).",
            spotWaitingForGps = "Getting your location…",
            spotSpeedTooFast = "Pull over safely before spotting a pothole. Capture is disabled above 10 km/h.",
            spotGpsAccuracyPoor = "Waiting for a clearer GPS fix before you can take a photo.",
            spotCaptureReady = "Hold steady and tap the shutter when you are safely stopped.",
            spotCapture = "Take photo",
            spotCameraPermissionDenied = "Camera access is required to spot potholes. Enable it in Settings.",
            profileTitle = "Profile",
            stubMessage = "Supabase + camera integration stubbed in Phase 1.",
            errorsGeneric = "Something went wrong. Try again.",
        )
    }
}
