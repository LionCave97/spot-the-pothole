import UIKit

enum ImageCompressor {
    static func compressToLimits(jpegData: Data) -> Data {
        guard let image = UIImage(data: jpegData) else { return jpegData }
        let scaled = scaleIfNeeded(image)
        var quality = SpotPhotoConstants.jpegQuality
        var output = scaled.jpegData(compressionQuality: quality) ?? jpegData
        while output.count > SpotPhotoConstants.maxBytes && quality > 0.5 {
            quality -= 0.05
            output = scaled.jpegData(compressionQuality: quality) ?? output
        }
        return output
    }

    private static func scaleIfNeeded(_ image: UIImage) -> UIImage {
        let longEdge = max(image.size.width, image.size.height)
        guard longEdge > CGFloat(SpotPhotoConstants.maxLongEdgePx) else { return image }
        let scale = CGFloat(SpotPhotoConstants.maxLongEdgePx) / longEdge
        let newSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        UIGraphicsBeginImageContextWithOptions(newSize, true, 1)
        image.draw(in: CGRect(origin: .zero, size: newSize))
        let scaled = UIGraphicsGetImageFromCurrentImageContext() ?? image
        UIGraphicsEndImageContext()
        return scaled
    }
}
