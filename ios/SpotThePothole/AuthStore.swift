import Foundation
import Supabase

@MainActor
final class AuthStore: ObservableObject, AuthSessionProviding {
    static let popiaNoticeVersion = "2026-01-popia-v1"

    @Published var profile: UserProfile?
    @Published var isSignedIn = false
    @Published var browseWithoutAccount = false
    @Published var errorMessage: String?
    @Published private(set) var accessToken: String?

    private let client = AppSupabase.client

    func refreshSession() async {
        do {
            let session = try await client.auth.session
            isSignedIn = true
            accessToken = session.accessToken
            profile = try await client
                .from("profiles")
                .select()
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
        } catch {
            isSignedIn = false
            accessToken = nil
            profile = nil
        }
    }

    func signIn(email: String, password: String) async {
        do {
            _ = try await client.auth.signIn(email: email, password: password)
            await refreshSession()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signUp(email: String, password: String) async {
        do {
            _ = try await client.auth.signUp(email: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        try? await client.auth.signOut()
        profile = nil
        isSignedIn = false
        accessToken = nil
    }

    func completeOnboarding(username: String, isAnonymous: Bool) async {
        struct Params: Encodable {
            let p_username: String
            let p_is_anonymous: Bool
            let p_notice_version: String
        }
        do {
            try await client.rpc(
                "complete_onboarding",
                params: Params(
                    p_username: username,
                    p_is_anonymous: isAnonymous,
                    p_notice_version: Self.popiaNoticeVersion
                )
            ).execute()
            await refreshSession()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteAccount() async {
        do {
            try await client.rpc("delete_my_account").execute()
            await signOut()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct UserProfile: Decodable {
    let id: UUID
    let username: String?
    let is_anonymous: Bool
    let points: Int
    let onboarding_completed_at: String?
}

enum UsernameValidator {
    static func validate(_ username: String) -> String? {
        let trimmed = username.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.contains(" ") || trimmed.contains("@") { return "looksLikeFullName" }
        let pattern = "^[a-z0-9_]{3,24}$"
        if trimmed.range(of: pattern, options: .regularExpression) == nil { return "invalidFormat" }
        return nil
    }

    static func normalize(_ username: String) -> String {
        username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
