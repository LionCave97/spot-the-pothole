package za.spotthepothole.app.auth

/**
 * Provides the current Supabase user access token for Storage uploads and `/api/game/*` calls.
 * Wire to Supabase Auth SDK in a follow-up; demo builds can inject a token via local config.
 */
fun interface AuthSessionProvider {
    fun accessToken(): String?
}
