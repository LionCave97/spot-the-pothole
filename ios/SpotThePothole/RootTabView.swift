import SwiftUI

struct RootTabView: View {
    var body: some View {
        TabView {
            MapScreen()
                .tabItem { Label(L10n.map, systemImage: "map") }
            SpotScreen()
                .tabItem { Label(L10n.spot, systemImage: "camera") }
            LeaderboardScreen()
                .tabItem { Label(L10n.leaderboard, systemImage: "list.number") }
            ProfileScreen()
                .tabItem { Label(L10n.profile, systemImage: "person") }
        }
    }
}

struct MapScreen: View {
    var body: some View {
        ScreenScaffold(title: L10n.map, message: L10n.stub)
    }
}

struct SpotScreen: View {
    var body: some View {
        ScreenScaffold(title: L10n.spot, message: L10n.stub)
    }
}

struct PotholeDetailScreen: View {
    let potholeId: String
    var body: some View {
        ScreenScaffold(title: "Pothole", message: "Detail for \(potholeId). \(L10n.stub)")
    }
}

struct LeaderboardScreen: View {
    var body: some View {
        ScreenScaffold(title: L10n.leaderboard, message: L10n.stub)
    }
}

struct ProfileScreen: View {
    var body: some View {
        ScreenScaffold(title: L10n.profile, message: L10n.stub)
    }
}

struct ScreenScaffold: View {
    let title: String
    let message: String

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text(title).font(.largeTitle.bold())
                Text(message).foregroundStyle(.secondary)
                Spacer()
            }
            .padding()
            .navigationTitle(title)
        }
    }
}

#Preview {
    RootTabView()
}
