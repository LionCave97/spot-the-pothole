import UIKit
import Vision

enum PhotoPrivacyBlurrer {
    private static let platePattern = try? NSRegularExpression(
        pattern: #"^[A-Z0-9]{2,3}\s?[0-9]{2,3}\s?[A-Z0-9]{2,4}$"#,
        options: [.caseInsensitive]
    )

    static func blurFacesAndPlates(jpegData: Data) throws -> Data {
        guard let image = UIImage(data: jpegData), let cgImage = image.cgImage else {
            throw SpotUploadError.blurFailed
        }

        var regions: [CGRect] = []
        let faceRequest = VNDetectFaceRectanglesRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        try handler.perform([faceRequest])
        faceRequest.results?.forEach { observation in
            regions.append(
                observation.boundingBox
                    .toImageRect(imageSize: image.size)
                    .insetBy(dx: -12, dy: -12)
            )
        }

        let textRequest = VNRecognizeTextRequest()
        textRequest.recognitionLevel = .accurate
        try handler.perform([textRequest])
        textRequest.results?.forEach { observation in
            guard let candidate = observation.topCandidates(1).first else { return }
            let token = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            if matchesPlate(token) {
                regions.append(observation.boundingBox.toImageRect(imageSize: image.size))
            }
        }

        let blurred = applyPixelBlur(to: image, regions: regions)
        return ImageCompressor.compressToLimits(jpegData: blurred.jpegData(compressionQuality: SpotPhotoConstants.jpegQuality) ?? jpegData)
    }

    private static func matchesPlate(_ token: String) -> Bool {
        guard let platePattern else { return false }
        let range = NSRange(location: 0, length: token.utf16.count)
        return platePattern.firstMatch(in: token, options: [], range: range) != nil
    }

    private static func applyPixelBlur(to image: UIImage, regions: [CGRect]) -> UIImage {
        UIGraphicsBeginImageContextWithOptions(image.size, true, image.scale)
        image.draw(at: .zero)
        let context = UIGraphicsGetCurrentContext()
        regions.forEach { rect in
            context?.setFillColor(UIColor.black.withAlphaComponent(0.55).cgColor)
            context?.fill(rect)
        }
        let output = UIGraphicsGetImageFromCurrentImageContext() ?? image
        UIGraphicsEndImageContext()
        return output
    }
}

private extension CGRect {
    func toImageRect(imageSize: CGSize) -> CGRect {
        CGRect(
            x: origin.x * imageSize.width,
            y: (1 - origin.y - height) * imageSize.height,
            width: width * imageSize.width,
            height: height * imageSize.height
        )
    }
}

enum SpotUploadError: Error {
    case blurFailed
    case signInRequired
    case uploadFailed
}
