import SwiftUI

struct RootTabView: View {
    @StateObject private var auth = AuthStore()

    var body: some View {
        TabView {
            MapScreen()
                .tabItem { Label(L10n.map, systemImage: "map") }
            SpotScreen(auth: auth)
                .tabItem { Label(L10n.spot, systemImage: "camera") }
            LeaderboardScreen()
                .tabItem { Label(L10n.leaderboard, systemImage: "list.number") }
            ProfileScreen(auth: auth)
                .tabItem { Label(L10n.profile, systemImage: "person") }
        }
        .task { await auth.refreshSession() }
    }
}

struct MapScreen: View {
    var body: some View {
        ScreenScaffold(title: L10n.map, message: L10n.stub)
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
    @ObservedObject var auth: AuthStore
    @State private var email = ""
    @State private var password = ""
    @State private var username = ""
    @State private var isAnonymous = false
    @State private var consent = false
    @State private var onboardingStep = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text(L10n.profile).font(.largeTitle.bold())

                    if !auth.isSignedIn {
                        Text(L10n.spotRequiresAuth).foregroundStyle(.secondary)
                        TextField(L10n.email, text: $email).textInputAutocapitalization(.never)
                        SecureField(L10n.password, text: $password)
                        Button(L10n.signIn) { Task { await auth.signIn(email: email, password: password) } }
                        Button(L10n.signUp) { Task { await auth.signUp(email: email, password: password) } }
                        Button(L10n.browseWithoutAccount) { auth.browseWithoutAccount = true }
                    } else if auth.profile?.onboarding_completed_at == nil {
                        Text(L10n.onboardingTitle)
                        if onboardingStep == 0 {
                            Toggle(L10n.consentCheckbox, isOn: $consent)
                            Button(L10n.continueAction, action: { onboardingStep = 1 }).disabled(!consent)
                        } else {
                            TextField(L10n.usernameLabel, text: $username)
                            Toggle(L10n.anonymousLabel, isOn: $isAnonymous)
                            Button(L10n.continueAction) {
                                Task {
                                    let normalized = UsernameValidator.normalize(username)
                                    guard UsernameValidator.validate(normalized) == nil else { return }
                                    await auth.completeOnboarding(username: normalized, isAnonymous: isAnonymous)
                                    onboardingStep = 2
                                }
                            }
                        }
                        if onboardingStep == 2 {
                            Text(L10n.permissionsLead)
                            Text(L10n.cameraReason)
                            Text(L10n.locationReason)
                        }
                    } else {
                        Text(auth.profile?.is_anonymous == true ? L10n.anonymousSpotter : (auth.profile?.username ?? ""))
                        Toggle(L10n.anonymousLabel, isOn: $isAnonymous)
                        Button(L10n.signOut) { Task { await auth.signOut() } }
                        Button(L10n.deleteAccount, role: .destructive) { Task { await auth.deleteAccount() } }
                    }

                    if let error = auth.errorMessage {
                        Text(error).foregroundStyle(.red)
                    }
                }
                .padding()
            }
            .navigationTitle(L10n.profile)
        }
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
