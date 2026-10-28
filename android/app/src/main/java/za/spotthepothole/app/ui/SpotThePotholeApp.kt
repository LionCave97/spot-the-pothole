package za.spotthepothole.app.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import za.spotthepothole.app.ui.screens.LeaderboardScreen
import za.spotthepothole.app.ui.screens.MapScreen
import za.spotthepothole.app.ui.screens.PotholeDetailScreen
import za.spotthepothole.app.ui.screens.ProfileScreen
import za.spotthepothole.app.ui.screens.SpotScreen
import za.spotthepothole.app.ui.strings.AppStrings

enum class AppRoute(val route: String, val labelKey: (AppStrings) -> String) {
    Map("map", { it.navMap }),
    Spot("spot", { it.navSpot }),
    Leaderboard("leaderboard", { it.navLeaderboard }),
    Profile("profile", { it.navProfile }),
}

@Composable
fun SpotThePotholeApp(strings: AppStrings = AppStrings.load()) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    Scaffold(
        bottomBar = {
            NavigationBar {
                AppRoute.entries.forEach { destination ->
                    NavigationBarItem(
                        selected = currentDestination?.hierarchy?.any { it.route == destination.route } == true,
                        onClick = {
                            navController.navigate(destination.route) {
                                popUpTo(navController.graph.startDestinationId) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        label = { Text(destination.labelKey(strings)) },
                        icon = { Text(destination.labelKey(strings).take(1)) },
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = AppRoute.Map.route,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(AppRoute.Map.route) { MapScreen(strings) }
            composable(AppRoute.Spot.route) { SpotScreen(strings) }
            composable("pothole/{id}") { backStackEntry ->
                PotholeDetailScreen(
                    strings = strings,
                    potholeId = backStackEntry.arguments?.getString("id"),
                )
            }
            composable(AppRoute.Leaderboard.route) { LeaderboardScreen(strings) }
            composable(AppRoute.Profile.route) { ProfileScreen(strings) }
        }
    }
}
