package za.spotthepothole.app.validation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UsernameValidatorTest {
    @Test
    fun acceptsValidUsername() {
        assertNull(UsernameValidator.validate("crater_captain"))
    }

    @Test
    fun rejectsFullNamePattern() {
        assertEquals("looksLikeFullName", UsernameValidator.validate("John Smith"))
    }
}
