package za.spotthepothole.app

/** Mirrors `shared/constants.ts` until shared codegen exists. */
object DomainConstants {
    const val POTHOL_MERGE_RADIUS_METERS = 15
    const val SPOT_CAPTURE_MAX_SPEED_KMH = 10
    const val SPOT_CAPTURE_MAX_GPS_ACCURACY_METERS = 35

    object PotholeStatus {
        const val OPEN = "open"
        const val FIXED = "fixed"
        const val COMEBACK = "comeback"
    }
}
