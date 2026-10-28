package za.spotthepothole.app.spot

data class CapturedSpotPhoto(
    val jpegBytes: ByteArray,
    val location: SpotLocationSample,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as CapturedSpotPhoto
        return jpegBytes.contentEquals(other.jpegBytes) && location == other.location
    }

    override fun hashCode(): Int {
        var result = jpegBytes.contentHashCode()
        result = 31 * result + location.hashCode()
        return result
    }
}
