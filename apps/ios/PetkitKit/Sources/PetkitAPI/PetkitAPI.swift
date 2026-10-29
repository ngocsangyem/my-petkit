// The generated `Client` and `Components` come from the OpenAPIGenerator build
// plugin; this file re-exports the runtime pieces a caller needs and builds a
// client bound to the paired server.
@_exported import OpenAPIRuntime
@_exported import OpenAPIURLSession
import Foundation
import HTTPTypes
import PetkitCore

/// Adds `Authorization: Bearer <token>` to every request. The token never
/// appears in a log line or an error.
public struct BearerAuthMiddleware: ClientMiddleware {
    private let token: @Sendable () -> String?

    public init(token: @escaping @Sendable () -> String?) {
        self.token = token
    }

    public func intercept(
        _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        if let token = token() {
            request.headerFields[.authorization] = "Bearer \(token)"
        }
        return try await next(request, body, baseURL)
    }
}

/// Sends the server's own origin as `Origin`. Only for the short sign-in
/// session that pairing opens: the server treats a cookie like a browser
/// credential and refuses an unsafe request without a matching `Origin`. A
/// bearer token needs none, so the paired client never sends one.
public struct SameOriginMiddleware: ClientMiddleware {
    public init() {}

    public func intercept(
        _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        if let scheme = baseURL.scheme, let host = baseURL.host() {
            let port = baseURL.port.map { ":\($0)" } ?? ""
            let bracketed = host.contains(":") ? "[\(host)]" : host
            request.headerFields[.origin] = "\(scheme)://\(bracketed)\(port)"
        }
        return try await next(request, body, baseURL)
    }
}

public extension Client {
    /// A client for `address`, over a session that trusts it the way pairing
    /// decided (pinned or system), authenticating with `token` when given.
    /// `signingIn` adds the `Origin` a cookie session needs.
    init(address: ServerAddress, session: URLSession, signingIn: Bool = false,
         token: @escaping @Sendable () -> String?) {
        var middlewares: [any ClientMiddleware] = [ErrorEnvelopeMiddleware(), BearerAuthMiddleware(token: token)]
        if signingIn { middlewares.append(SameOriginMiddleware()) }
        self.init(
            serverURL: address.baseURL,
            transport: URLSessionTransport(configuration: .init(session: session)),
            middlewares: middlewares
        )
    }
}
