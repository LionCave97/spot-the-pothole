import Foundation

protocol AuthSessionProviding {
    var accessToken: String? { get }
}

struct DemoAuthSessionProvider: AuthSessionProviding {
    var accessToken: String? { nil }
}

enum SpotUploadProgress: Equatable {
    case blurring
    case uploading(percent: Int)
    case submitting
    case done
}

enum SpotUploadService {
    static func submitSpot(
        capture: CapturedSpotPhoto,
        name: String,
        auth: AuthSessionProviding,
        supabaseUrl: String,
        webApiBase: String,
        onProgress: @escaping (SpotUploadProgress) -> Void
    ) async throws {
        guard let token = auth.accessToken else { throw SpotUploadError.signInRequired }

        onProgress(.blurring)
        let blurred = try PhotoPrivacyBlurrer.blurFacesAndPlates(jpegData: capture.jpegData)

        guard let userId = jwtSubject(token) else { throw SpotUploadError.signInRequired }
        let fileName = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-") + ".jpg"
        let storagePath = SpotPhotoPath.build(userId: userId, fileName: fileName)

        try await uploadWithRetry(
            token: token,
            supabaseUrl: supabaseUrl,
            storagePath: storagePath,
            bytes: blurred,
            onProgress: onProgress
        )

        onProgress(.submitting)
        try await submitReport(
            token: token,
            webApiBase: webApiBase,
            capture: capture,
            name: name,
            photoPath: storagePath
        )
        onProgress(.done)
    }

    private static func uploadWithRetry(
        token: String,
        supabaseUrl: String,
        storagePath: String,
        bytes: Data,
        onProgress: @escaping (SpotUploadProgress) -> Void
    ) async throws {
        var lastError: Error = SpotUploadError.uploadFailed
        for attempt in 1...3 {
            onProgress(.uploading(percent: min(100, attempt * 30)))
            do {
                try await uploadOnce(token: token, supabaseUrl: supabaseUrl, storagePath: storagePath, bytes: bytes)
                onProgress(.uploading(percent: 100))
                return
            } catch {
                lastError = error
                try await Task.sleep(nanoseconds: UInt64(attempt) * 500_000_000)
            }
        }
        throw lastError
    }

    private static func uploadOnce(
        token: String,
        supabaseUrl: String,
        storagePath: String,
        bytes: Data
    ) async throws {
        let base = supabaseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let url = URL(string: "\(base)/storage/v1/object/\(SpotPhotoConstants.quarantineBucket)/\(storagePath)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = bytes
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw SpotUploadError.uploadFailed
        }
    }

    private static func submitReport(
        token: String,
        webApiBase: String,
        capture: CapturedSpotPhoto,
        name: String,
        photoPath: String
    ) async throws {
        let base = webApiBase.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let url = URL(string: "\(base)/api/game/spot")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload: [String: Any] = [
            "lat": capture.location.lat,
            "lng": capture.location.lng,
            "name": name,
            "photo_path": photoPath,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw SpotUploadError.uploadFailed
        }
    }

    private static func jwtSubject(_ jwt: String) -> String? {
        let parts = jwt.split(separator: ".")
        guard parts.count >= 2 else { return nil }
        var base64 = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 { base64.append("=") }
        guard let data = Data(base64Encoded: base64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let sub = json["sub"] as? String else { return nil }
        return sub
    }
}
