import XCTest
@testable import SpotThePothole

final class SpotPhotoPathTests: XCTestCase {
    func testBuildsUserScopedPath() {
        XCTAssertEqual(
            SpotPhotoPath.build(userId: "user-1", fileName: "photo.jpg"),
            "user-1/photo.jpg"
        )
    }
}
