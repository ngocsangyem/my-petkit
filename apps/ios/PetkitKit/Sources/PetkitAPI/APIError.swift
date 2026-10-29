import Foundation
import HTTPTypes
import OpenAPIRuntime

/// A refusal from the user plane, decoded from its error envelope
/// `{"error": {"code", "message"}}` (shared/errors.py). Thrown by
/// `ErrorEnvelopeMiddleware` for every 4xx/5xx, so callers read the success
/// body with the generated `.ok` accessor and handle one error type.
public struct APIError: Error, Equatable, Sendable, LocalizedError {
    public let status: Int
    public let code: String
    public let message: String
    /// Seconds from `Retry-After`, sent only once a limit has locked.
    public let retryAfter: Int?

    public init(status: Int, code: String, message: String, retryAfter: Int? = nil) {
        self.status = status
        self.code = code
        self.message = message
        self.retryAfter = retryAfter
    }

    public var errorDescription: String? { message }

    public var needsStepUp: Bool { status == 403 && code == "step_up_required" }
    public var isUnauthenticated: Bool { status == 401 }

    /// The `APIError` inside whatever the generated client threw, if any.
    public static func from(_ error: any Error) -> APIError? {
        if let api = error as? APIError { return api }
        if let client = error as? ClientError { return from(client.underlyingError) }
        return nil
    }
}

/// Turns a non-2xx response into a thrown `APIError`.
public struct ErrorEnvelopeMiddleware: ClientMiddleware {
    static let maxEnvelopeBytes = 64 * 1024

    public init() {}

    public func intercept(
        _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        let (response, responseBody) = try await next(request, body, baseURL)
        guard response.status.code >= 400 else { return (response, responseBody) }
        var data = Data()
        if let responseBody {
            data = (try? await Data(collecting: responseBody, upTo: Self.maxEnvelopeBytes)) ?? Data()
        }
        throw Self.decode(status: response.status.code, data: data,
                          retryAfter: response.headerFields[.retryAfter])
    }

    static func decode(status: Int, data: Data, retryAfter: String?) -> APIError {
        struct Envelope: Decodable {
            struct Inner: Decodable { let code: String; let message: String }
            let error: Inner
        }
        let seconds = retryAfter.flatMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        if let envelope = try? JSONDecoder().decode(Envelope.self, from: data) {
            return APIError(status: status, code: envelope.error.code,
                            message: envelope.error.message, retryAfter: seconds)
        }
        return APIError(status: status, code: "http_\(status)",
                        message: HTTPURLResponse.localizedString(forStatusCode: status).capitalized,
                        retryAfter: seconds)
    }
}
