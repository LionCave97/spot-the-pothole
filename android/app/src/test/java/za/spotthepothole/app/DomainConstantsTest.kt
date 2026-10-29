package za.spotthepothole.app

import org.junit.Assert.assertEquals
import org.junit.Test

class DomainConstantsTest {
    @Test
    fun mergeRadiusMatchesSharedPackage() {
        assertEquals(15, DomainConstants.POTHOL_MERGE_RADIUS_METERS)
    }

    @Test
    fun supabaseBuildConfigUsesPlaceholderValues() {
        assertEquals("http://10.0.2.2:54321", BuildConfig.SUPABASE_URL)
        assertEquals("demo-anon-key", BuildConfig.SUPABASE_ANON_KEY)
    }
}
