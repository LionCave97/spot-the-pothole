import CoreLocation
import Foundation

@MainActor
final class SpotLocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published private(set) var latest: SpotLocationSample?

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 1
        manager.activityType = .otherNavigation
    }

    func requestAuthorizationAndStart() {
        manager.requestWhenInUseAuthorization()
        manager.startUpdatingLocation()
    }

    func stop() {
        manager.stopUpdatingLocation()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        latest = SpotLocationSample(
            lat: loc.coordinate.latitude,
            lng: loc.coordinate.longitude,
            accuracyMeters: loc.horizontalAccuracy,
            speedMps: loc.speed >= 0 ? loc.speed : nil,
            capturedAt: loc.timestamp
        )
    }
}
