package za.spotthepothole.app.spot

/** Mirrors shared/media/constants.ts */
object SpotPhotoConstants {
    const val MAX_BYTES = 1_500_000
    const val MAX_LONG_EDGE_PX = 1920
    const val JPEG_QUALITY = 82
    const val QUARANTINE_BUCKET = "spot-photos-quarantine"
    const val PUBLISHED_BUCKET = "spot-photos"
}

object SpotPhotoPath {
    fun build(userId: String, fileName: String): String {
        require(userId.isNotBlank() && !userId.contains('/') && !userId.contains("..")) {
            "Invalid user id"
        }
        require(fileName.isNotBlank() && !fileName.contains('/') && !fileName.contains("..")) {
            "Invalid file name"
        }
        return "$userId/$fileName"
    }
}
