import Foundation
import XCTest
@testable import SpotThePothole

final class SpotCaptureGateTests: XCTestCase {
    func testBlocksHighSpeed() {
        let sample = SpotLocationSample(
            lat: -26,
            lng: 28,
            accuracyMeters: 8,
            speedMps: 4,
            capturedAt: Date()
        )
        let result = SpotCaptureGate.evaluate(location: sample)
        XCTAssertFalse(result.allowed)
        XCTAssertEqual(result.reason, .speed)
    }
}
