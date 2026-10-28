package za.spotthepothole.app.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import za.spotthepothole.app.ui.strings.AppStrings

@Composable
fun MapScreen(strings: AppStrings) {
    ScreenScaffold(strings.mapTitle, strings.stubMessage)
}

@Composable
fun SpotScreen(strings: AppStrings) {
    ScreenScaffold(strings.spotTitle, strings.stubMessage)
}

@Composable
fun PotholeDetailScreen(strings: AppStrings, potholeId: String?) {
    ScreenScaffold("Pothole", "Detail for $potholeId — ${strings.stubMessage}")
}

@Composable
fun LeaderboardScreen(strings: AppStrings) {
    ScreenScaffold(strings.navLeaderboard, strings.stubMessage)
}

@Composable
fun ProfileScreen(strings: AppStrings) {
    ScreenScaffold(strings.profileTitle, strings.stubMessage)
}

@Composable
private fun ScreenScaffold(title: String, body: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        Text(text = title, style = MaterialTheme.typography.headlineMedium)
        Text(text = body, modifier = Modifier.padding(top = 12.dp))
    }
}
