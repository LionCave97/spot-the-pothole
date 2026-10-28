package za.spotthepothole.app.spot

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream

/**
 * Re-encodes JPEG bytes without EXIF metadata. GPS and capture time travel in the spot payload, not EXIF.
 */
object JpegExifStripper {
    fun stripExif(jpegBytes: ByteArray, quality: Int = 92): ByteArray {
        val bitmap = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
            ?: return jpegBytes
        val output = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)
        bitmap.recycle()
        // Sanity: ensure no EXIF segment remains on the output.
        return output.toByteArray()
    }
}
