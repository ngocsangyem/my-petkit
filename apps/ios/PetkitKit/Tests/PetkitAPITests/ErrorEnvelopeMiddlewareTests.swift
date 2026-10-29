import Foundation
import Testing
@testable import PetkitAPI

struct ErrorEnvelopeMiddlewareTests {
    @Test func decodesTheServerEnvelope() {
        let body = Data(#"{"error": {"code": "step_up_required", "message": "Re-enter your password."}}"#.utf8)
        let error = ErrorEnvelopeMiddleware.decode(status: 403, data: body, retryAfter: nil)
        #expect(error.needsStepUp)
        #expect(error.message == "Re-enter your password.")
    }

    @Test func keepsRetryAfterAndFallsBackOnABodyThatIsNotAnEnvelope() {
        let error = ErrorEnvelopeMiddleware.decode(status: 429, data: Data("<html>".utf8), retryAfter: "8")
        #expect(error.code == "http_429")
        #expect(error.retryAfter == 8)
    }
}
