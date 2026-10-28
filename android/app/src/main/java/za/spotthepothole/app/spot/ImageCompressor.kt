package za.spotthepothole.app.spot

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

object ImageCompressor {
    fun compressToLimits(jpegBytes: ByteArray): ByteArray {
        var bitmap = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
            ?: return jpegBytes

        val longEdge = max(bitmap.width, bitmap.height)
        if (longEdge > SpotPhotoConstants.MAX_LONG_EDGE_PX) {
            val scale = SpotPhotoConstants.MAX_LONG_EDGE_PX.toFloat() / longEdge.toFloat()
            val targetW = (bitmap.width * scale).roundToInt().coerceAtLeast(1)
            val targetH = (bitmap.height * scale).roundToInt().coerceAtLeast(1)
            val scaled = Bitmap.createScaledBitmap(bitmap, targetW, targetH, true)
            if (scaled != bitmap) {
                bitmap.recycle()
            }
            bitmap = scaled
        }

        var quality = SpotPhotoConstants.JPEG_QUALITY
        var output: ByteArray
        do {
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
            output = stream.toByteArray()
            quality -= 5
        } while (output.size > SpotPhotoConstants.MAX_BYTES && quality >= 50)

        bitmap.recycle()
        return output
    }
}
