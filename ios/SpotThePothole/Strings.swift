import Foundation

/// Phase 1 English strings (subset of shared/strings/en.json).
enum L10n {
    static let appName = "Spot the Pothole"
    static let tagline = "Name it. Confirm it. Track the fix."
    static let map = "Map"
    static let spot = "Spot"
    static let spotTitle = "Spot a pothole"
    static let spotCameraHint = "Take a live photo at the pothole (GPS required)."
    static let spotWaitingForGps = "Getting your location…"
    static let spotSpeedTooFast = "Pull over safely before spotting a pothole. Capture is disabled above 10 km/h."
    static let spotGpsAccuracyPoor = "Waiting for a clearer GPS fix before you can take a photo."
    static let spotCaptureReady = "Hold steady and tap the shutter when you are safely stopped."
    static let spotCapture = "Take photo"
    static let spotCameraPermissionDenied = "Camera access is required to spot potholes. Enable it in Settings."
    static let leaderboard = "Leaderboard"
    static let profile = "Profile"
    static let stub = "Supabase + camera integration stubbed in Phase 1."
}
