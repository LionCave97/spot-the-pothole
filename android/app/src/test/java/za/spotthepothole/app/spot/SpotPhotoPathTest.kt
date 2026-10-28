package za.spotthepothole.app.spot

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SpotPhotoPathTest {
    @Test
    fun buildsUserScopedPath() {
        assertEquals(
            "user-1/photo.jpg",
            SpotPhotoPath.build("user-1", "photo.jpg"),
        )
    }

    @Test
    fun rejectsTraversal() {
        assertThrows(IllegalArgumentException::class.java) {
            SpotPhotoPath.build("user-1", "../x.jpg")
        }
    }
}
