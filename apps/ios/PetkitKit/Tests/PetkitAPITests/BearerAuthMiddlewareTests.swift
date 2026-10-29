import Foundation
import HTTPTypes
import Testing
@testable import PetkitAPI

struct BearerAuthMiddlewareTests {
    @Test func addsTheTokenAsABearerHeader() async throws {
        let middleware = BearerAuthMiddleware { "tok-123" }
        let seen = try await capture(middleware)
        #expect(seen.headerFields[.authorization] == "Bearer tok-123")
    }

    @Test func sendsNoHeaderWithoutAToken() async throws {
        let middleware = BearerAuthMiddleware { nil }
        let seen = try await capture(middleware)
        #expect(seen.headerFields[.authorization] == nil)
    }

    private func capture(_ middleware: BearerAuthMiddleware) async throws -> HTTPRequest {
        let box = RequestBox()
        _ = try await middleware.intercept(
            HTTPRequest(method: .get, scheme: "https", authority: "h", path: "/api/info"),
            body: nil,
            baseURL: URL(string: "https://h")!,
            operationID: "getInfo"
        ) { request, _, _ in
            await box.set(request)
            return (HTTPResponse(status: .ok), nil)
        }
        return try #require(await box.request)
    }
}

private actor RequestBox {
    var request: HTTPRequest?
    func set(_ value: HTTPRequest) { request = value }
}
