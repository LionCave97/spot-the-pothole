import XCTest
@testable import SpotThePothole

final class DomainConstantsTests: XCTestCase {
    func testMergeRadiusMatchesSharedPackage() {
        XCTAssertEqual(DomainConstants.potholeMergeRadiusMeters, 15)
    }

    func testSupabaseConfigUsesPlaceholderValues() {
        XCTAssertEqual(AppConfig.supabaseAnonKey, "demo-anon-key")
        XCTAssertEqual(AppConfig.supabaseURL.absoluteString, "http://127.0.0.1:54321")
    }

    func testSupabaseClientInitializes() {
        XCTAssertNotNil(AppSupabase.client)
    }
}
