package za.spotthepothole.app.spot

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.tasks.await
import kotlin.math.max
import kotlin.math.min

class PhotoPrivacyBlurrer {
    private val faceDetector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .build(),
    )
    private val textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    private val platePattern = Regex("""^[A-Z0-9]{2,3}\s?[0-9]{2,3}\s?[A-Z0-9]{2,4}$""")

    suspend fun blurFacesAndPlates(jpegBytes: ByteArray): Result<ByteArray> = runCatching {
        val original = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
            ?: error("Invalid image")

        val input = InputImage.fromBitmap(original, 0)
        val faces = faceDetector.process(input).await()
        val text = textRecognizer.process(input).await()

        val regions = mutableListOf<Rect>()
        faces.forEach { face ->
            face.boundingBox?.let { regions.add(expand(it, original.width, original.height, 0.15f)) }
        }
        text.textBlocks.forEach { block ->
            val token = block.text.replace("\n", " ").trim().uppercase()
            if (platePattern.matches(token)) {
                regions.add(expand(block.boundingBox, original.width, original.height, 0.08f))
            }
        }

        val mutable = original.copy(Bitmap.Config.ARGB_8888, true)
        if (original != mutable) {
            original.recycle()
        }

        val paint = Paint().apply { color = Color.BLACK }
        regions.forEach { rect ->
            pixelateRegion(mutable, rect)
            Canvas(mutable).drawRect(rect, paint.apply { alpha = 120 })
        }

        val stream = java.io.ByteArrayOutputStream()
        mutable.compress(Bitmap.CompressFormat.JPEG, SpotPhotoConstants.JPEG_QUALITY, stream)
        val compressed = ImageCompressor.compressToLimits(stream.toByteArray())
        mutable.recycle()
        compressed
    }

    private fun expand(rect: Rect, maxW: Int, maxH: Int, paddingRatio: Float): Rect {
        val padX = (rect.width() * paddingRatio).toInt()
        val padY = (rect.height() * paddingRatio).toInt()
        return Rect(
            (rect.left - padX).coerceAtLeast(0),
            (rect.top - padY).coerceAtLeast(0),
            (rect.right + padX).coerceAtMost(maxW),
            (rect.bottom + padY).coerceAtMost(maxH),
        )
    }

    private fun pixelateRegion(bitmap: Bitmap, region: Rect) {
        val block = max(12, min(region.width(), region.height()) / 6)
        var y = region.top
        while (y < region.bottom) {
            var x = region.left
            while (x < region.right) {
                val sampleX = min(x + block / 2, bitmap.width - 1)
                val sampleY = min(y + block / 2, bitmap.height - 1)
                val color = bitmap.getPixel(sampleX, sampleY)
                val fill = Rect(
                    x,
                    y,
                    min(x + block, region.right),
                    min(y + block, region.bottom),
                )
                Canvas(bitmap).drawRect(fill, Paint().apply { this.color = color })
                x += block
            }
            y += block
        }
    }
}
