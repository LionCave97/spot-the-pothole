package za.spotthepothole.app.ui.strings

/**
 * Phase 1: English strings mirrored from shared/strings/en.json (subset).
 * TODO: codegen from shared/strings in Phase 2 i18n work.
 */
data class AppStrings(
    val appName: String,
    val tagline: String,
    val navMap: String,
    val navSpot: String,
    val navLeaderboard: String,
    val navProfile: String,
    val mapTitle: String,
    val spotTitle: String,
    val profileTitle: String,
    val stubMessage: String,
) {
    companion object {
        fun load() = AppStrings(
            appName = "Spot the Pothole",
            tagline = "Name it. Confirm it. Track the fix.",
            navMap = "Map",
            navSpot = "Spot",
            navLeaderboard = "Leaderboard",
            navProfile = "Profile",
            mapTitle = "Pothole map",
            spotTitle = "Spot a pothole",
            profileTitle = "Profile",
            stubMessage = "Supabase + camera integration stubbed in Phase 1.",
        )
    }
}
