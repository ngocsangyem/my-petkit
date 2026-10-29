import Foundation
import PetkitAPI

/// GET requests the generated client cannot make: `/api/devicelogs/{path}`
/// spans several path segments (a path parameter would percent-encode the
/// slashes), and `/api/events` carries a `device_id` that may be a string,
/// which the generated type would refuse. Errors decode the same envelope as
/// the client, so `session.call` still sees `step_up_required`.
extension ServerSession {
    nonisolated static let rawEnvelopeLimit = 64 * 1024

    func rawGET(segments: [String], query: [URLQueryItem] = []) async throws -> Data {
        guard var components = URLComponents(url: paired.address.baseURL, resolvingAgainstBaseURL: false) else {
            throw URLError(.badURL)
        }
        components.percentEncodedPath = "/" + segments.map(Self.encodeSegment).joined(separator: "/")
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else { throw URLError(.badURL) }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(paired.token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else {
            throw Self.apiError(status: http.statusCode, data: data.prefix(Self.rawEnvelopeLimit),
                                retryAfter: http.value(forHTTPHeaderField: "Retry-After"))
        }
        return data
    }

    /// Each segment percent-encoded on its own, so `/` inside a log path
    /// stays a separator and nothing else can escape the route.
    nonisolated static func encodeSegment(_ segment: String) -> String {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "/?#")
        return segment.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
    }

    nonisolated static func apiError(status: Int, data: Data, retryAfter: String?) -> APIError {
        struct Envelope: Decodable {
            struct Inner: Decodable { let code: String; let message: String }
            let error: Inner
        }
        let seconds = retryAfter.flatMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        if let envelope = try? JSONDecoder().decode(Envelope.self, from: data) {
            return APIError(status: status, code: envelope.error.code, message: envelope.error.message,
                            retryAfter: seconds)
        }
        return APIError(status: status, code: "http_\(status)",
                        message: HTTPURLResponse.localizedString(forStatusCode: status).capitalized,
                        retryAfter: seconds)
    }
}
