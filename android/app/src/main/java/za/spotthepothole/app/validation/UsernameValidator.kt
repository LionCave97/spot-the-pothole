package za.spotthepothole.app.validation

object UsernameValidator {
    private val pattern = Regex("^[a-z0-9_]{3,24}$")
    private val blocked = setOf("admin", "moderator", "support", "anonymous", "spotthepothole")

    fun validate(username: String): String? {
        val trimmed = username.trim()
        if (trimmed.contains(' ') || trimmed.contains('@')) return "looksLikeFullName"
        val normalized = trimmed.lowercase()
        if (!pattern.matches(normalized)) return "invalidFormat"
        if (blocked.contains(normalized)) return "blocked"
        return null
    }

    fun normalize(username: String): String = username.trim().lowercase()
}
