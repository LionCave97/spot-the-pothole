package za.spotthepothole.app

import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest

/** Supabase client configured from [BuildConfig] placeholders (no secrets in git). */
object AppSupabase {
    val client by lazy {
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
        ) {
            install(Postgrest)
        }
    }
}
