import Foundation

enum SpotPhotoConstants {
    static let maxBytes = 1_500_000
    static let maxLongEdgePx = 1920
    static let jpegQuality: CGFloat = 0.82
    static let quarantineBucket = "spot-photos-quarantine"
    static let publishedBucket = "spot-photos"
}

enum SpotPhotoPath {
    static func build(userId: String, fileName: String) -> String {
        guard !userId.isEmpty, !userId.contains("/"), !userId.contains("..") else {
            fatalError("Invalid user id")
        }
        guard !fileName.isEmpty, !fileName.contains("/"), !fileName.contains("..") else {
            fatalError("Invalid file name")
        }
        return "\(userId)/\(fileName)"
    }
}
