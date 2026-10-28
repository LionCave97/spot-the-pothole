package za.spotthepothole.app.data

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class UserProfile(
    val id: String,
    val username: String? = null,
    @SerialName("is_anonymous") val isAnonymous: Boolean = false,
    val points: Int = 0,
    @SerialName("onboarding_completed_at") val onboardingCompletedAt: String? = null,
)

class AuthRepository {
    private val supabase = za.spotthepothole.app.AppSupabase.client

    private val _profile = MutableStateFlow<UserProfile?>(null)
    val profile = _profile.asStateFlow()

    suspend fun refreshSession() {
        val user = supabase.auth.currentUserOrNull()
        if (user == null) {
            _profile.value = null
            return
        }
        _profile.value = supabase.postgrest["profiles"].select {
            filter {
                eq("id", user.id)
            }
        }.decodeSingleOrNull<UserProfile>()
    }

    suspend fun signIn(email: String, password: String) {
        supabase.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
        refreshSession()
    }

    suspend fun signUp(email: String, password: String) {
        supabase.auth.signUpWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signOut() {
        supabase.auth.signOut()
        _profile.value = null
    }

    suspend fun completeOnboarding(username: String, isAnonymous: Boolean) {
        supabase.postgrest.rpc("complete_onboarding") {
            parameter("p_username", username)
            parameter("p_is_anonymous", isAnonymous)
            parameter("p_notice_version", POPIA_NOTICE_VERSION)
        }
        refreshSession()
    }

    suspend fun deleteAccount() {
        supabase.postgrest.rpc("delete_my_account")
        signOut()
    }

    fun accessToken(): String? = supabase.auth.currentSessionOrNull()?.accessToken

    companion object {
        const val POPIA_NOTICE_VERSION = "2026-01-popia-v1"
    }
}
