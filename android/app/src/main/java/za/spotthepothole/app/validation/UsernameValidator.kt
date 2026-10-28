package za.spotthepothole.app.validation

object UsernameValidator {
    private val pattern = Regex("^[a-z0-9_]{3,24}$")
    private val blocked = setOf("admin", "moderator", "support", "anonymous", "spotthepothole")

    fun validate(username: String): String? {
        val normalized = username.trim().lowercase()
        if (!pattern.matches(normalized)) return "invalidFormat"
        if (blocked.contains(normalized)) return "blocked"
        if (username.contains(' ') || username.contains('@')) return "looksLikeFullName"
        return null
    }

    fun normalize(username: String): String = username.trim().lowercase()
}
