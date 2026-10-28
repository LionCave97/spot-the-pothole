import Foundation

/// Mirrors shared/capture/constants.ts
enum SpotCaptureConstants {
    static let maxSpeedKmh = 10.0
    static let maxGpsAccuracyMeters = 35.0
}

struct SpotLocationSample: Equatable {
    let lat: Double
    let lng: Double
    let accuracyMeters: Double
    let speedMps: Double?
    let capturedAt: Date
}

enum SpotCaptureBlockReason: Equatable {
    case noLocation
    case accuracy
    case speed
}

struct SpotCaptureGateResult {
    let allowed: Bool
    let reason: SpotCaptureBlockReason?
    let location: SpotLocationSample?
}

enum SpotCaptureGate {
    static func evaluate(location: SpotLocationSample?) -> SpotCaptureGateResult {
        guard let location else {
            return SpotCaptureGateResult(allowed: false, reason: .noLocation, location: nil)
        }

        if !location.accuracyMeters.isFinite
            || location.accuracyMeters <= 0
            || location.accuracyMeters > SpotCaptureConstants.maxGpsAccuracyMeters {
            return SpotCaptureGateResult(allowed: false, reason: .accuracy, location: location)
        }

        if let speedMps = location.speedMps, speedMps >= 0 {
            let speedKmh = speedMps * 3.6
            if speedKmh > SpotCaptureConstants.maxSpeedKmh {
                return SpotCaptureGateResult(allowed: false, reason: .speed, location: location)
            }
        }

        return SpotCaptureGateResult(allowed: true, reason: nil, location: location)
    }
}
