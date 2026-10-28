import Foundation

/// Mirrors `shared/constants.ts` until shared codegen exists.
enum DomainConstants {
    static let potholeMergeRadiusMeters = 15
    static let spotCaptureMaxSpeedKmh = 10.0
    static let spotCaptureMaxGpsAccuracyMeters = 35.0

    enum PotholeStatus: String {
        case open
        case fixed
        case comeback
    }
}
