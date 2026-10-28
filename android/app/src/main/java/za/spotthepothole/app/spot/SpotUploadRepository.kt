package za.spotthepothole.app.spot

import kotlinx.coroutines.delay
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import za.spotthepothole.app.BuildConfig
import za.spotthepothole.app.auth.AuthSessionProvider
import java.io.IOException
import java.time.Instant
import kotlin.math.min

sealed class SpotUploadProgress {
    data object Blurring : SpotUploadProgress()
    data class Uploading(val percent: Int) : SpotUploadProgress()
    data object Submitting : SpotUploadProgress()
    data object Done : SpotUploadProgress()
}

class SpotUploadRepository(
    private val authSessionProvider: AuthSessionProvider,
    private val blurrer: PhotoPrivacyBlurrer = PhotoPrivacyBlurrer(),
    private val http: OkHttpClient = OkHttpClient(),
) {
    suspend fun submitSpot(
        capture: CapturedSpotPhoto,
        potholeName: String,
        onProgress: (SpotUploadProgress) -> Unit,
    ): Result<Unit> {
        val token = authSessionProvider.accessToken()
            ?: return Result.failure(IllegalStateException("sign_in_required"))

        onProgress(SpotUploadProgress.Blurring)
        val blurred = blurrer.blurFacesAndPlates(capture.jpegBytes).getOrElse { return Result.failure(it) }

        val userId = parseUserId(token) ?: return Result.failure(IllegalStateException("invalid_token"))
        val fileName = "${Instant.now()}.jpg".replace(":", "-")
        val storagePath = SpotPhotoPath.build(userId, fileName)

        uploadWithRetry(token, storagePath, blurred, onProgress).getOrElse { return Result.failure(it) }

        onProgress(SpotUploadProgress.Submitting)
        submitReport(token, capture, potholeName, storagePath).getOrElse { return Result.failure(it) }

        onProgress(SpotUploadProgress.Done)
        return Result.success(Unit)
    }

    private suspend fun uploadWithRetry(
        token: String,
        storagePath: String,
        bytes: ByteArray,
        onProgress: (SpotUploadProgress) -> Unit,
    ): Result<Unit> {
        var attempt = 0
        var lastError: Throwable? = null
        while (attempt < 3) {
            attempt += 1
            onProgress(SpotUploadProgress.Uploading(min(100, attempt * 30)))
            try {
                uploadOnce(token, storagePath, bytes)
                onProgress(SpotUploadProgress.Uploading(100))
                return Result.success(Unit)
            } catch (err: Throwable) {
                lastError = err
                delay(500L * attempt)
            }
        }
        return Result.failure(lastError ?: IOException("upload_failed"))
    }

    private fun uploadOnce(token: String, storagePath: String, bytes: ByteArray) {
        val url = "${BuildConfig.SUPABASE_URL.trimEnd('/')}/storage/v1/object/${SpotPhotoConstants.STORAGE_BUCKET}/$storagePath"
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "image/jpeg")
            .addHeader("x-upsert", "false")
            .post(bytes.toRequestBody("image/jpeg".toMediaType()))
            .build()

        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("storage_upload_${response.code}")
            }
        }
    }

    private fun submitReport(
        token: String,
        capture: CapturedSpotPhoto,
        name: String,
        photoPath: String,
    ): Result<Unit> = runCatching {
        val payload = JSONObject()
            .put("lat", capture.location.lat)
            .put("lng", capture.location.lng)
            .put("name", name)
            .put("photo_path", photoPath)

        val url = "${BuildConfig.WEB_API_BASE.trimEnd('/')}/api/game/spot"
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .addHeader(SpotPhotoConstants.BLUR_VERIFIED_HEADER, SpotPhotoConstants.BLUR_VERIFIED_VALUE)
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()

        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("spot_submit_${response.code}")
            }
        }
    }

    private fun parseUserId(jwt: String): String? {
        val parts = jwt.split('.')
        if (parts.size < 2) return null
        val payload = String(android.util.Base64.decode(parts[1], android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING))
        return JSONObject(payload).optString("sub").takeIf { it.isNotBlank() }
    }
}
