import Foundation
import Supabase

enum AppConfig {
    static var supabaseURL: URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String
            ?? ProcessInfo.processInfo.environment["SUPABASE_URL"]
            ?? "http://127.0.0.1:54321"
        guard let url = URL(string: raw) else {
            preconditionFailure("Invalid SUPABASE_URL: \(raw)")
        }
        return url
    }

    static var supabaseAnonKey: String {
        Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String
            ?? ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"]
            ?? "demo-anon-key"
    }
}

enum AppSupabase {
    static let client: SupabaseClient = {
        SupabaseClient(
            supabaseURL: AppConfig.supabaseURL,
            supabaseKey: AppConfig.supabaseAnonKey
        )
    }()
}
