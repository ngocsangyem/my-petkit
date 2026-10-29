import PetkitAPI
import PetkitCore
import XCTest
@testable import MyPetkit

/// Pairs by hand against a real server: first run on a fresh one, sign-in
/// once its admin exists (password `correct horse battery`). Needs
/// `TEST_RUNNER_PETKIT_TEST_URL` (its user plane), `TEST_RUNNER_PETKIT_TEST_PIN`
/// and `TEST_RUNNER_PETKIT_SETUP_TOKEN` (both from its log). Skipped without them.
@MainActor
final class PairingFlowIntegrationTests: XCTestCase {
    func testHandPairingIssuesAWorkingToken() async throws {
        let env = ProcessInfo.processInfo.environment
        guard let url = env["PETKIT_TEST_URL"], let setupToken = env["PETKIT_SETUP_TOKEN"] else {
            throw XCTSkip("no fresh test server configured")
        }
        var paired: PairedServer?
        let model = OnboardingModel { paired = $0 }
        model.addressText = url
        model.submitAddress()
        try await waitUntil { !model.busy }
        guard case .confirmFingerprint(_, let pin) = model.step else {
            return XCTFail("expected the fingerprint step, got \(model.step), error \(model.error ?? "-")")
        }
        XCTAssertEqual(pin.hex, env["PETKIT_TEST_PIN"])

        model.trustFingerprint()
        try await waitUntil { !model.busy }
        // A server that already has its admin (a rerun) takes the sign-in path.
        switch model.step {
        case .firstRun: model.createAdmin(setupToken: setupToken, password: "correct horse battery")
        case .signIn: model.signIn(password: "correct horse battery")
        default: return XCTFail("expected first run or sign-in, got \(model.step), error \(model.error ?? "-")")
        }
        try await waitUntil { !model.busy }
        let server = try XCTUnwrap(paired, model.error ?? "not paired")
        XCTAssertEqual(server.address.trust, .pinned(pin))

        let session = ServerSession(paired: server)
        let info = try await session.client.getServerInfo().ok.body.json
        XCTAssertNotNil(info)

        // R3 with this token: the step-up prompt is answered by the test.
        let granted = Task { @MainActor in
            try await waitUntil { session.stepUp != nil }
            _ = try await session.client.authStepUp(body: .json(.init(password: "correct horse battery"))).ok
            session.stepUp?.finish(granted: true)
        }
        let code = try await session.call(purpose: "Pair another phone") {
            try await session.client.authPairingCreate().ok.body.json.code
        }
        try await granted.value
        XCTAssertFalse(code.isEmpty)
    }

    private func waitUntil(timeout: TimeInterval = 15, _ condition: @MainActor () -> Bool) async throws {
        let deadline = Date.now.addingTimeInterval(timeout)
        while !condition() {
            guard Date.now < deadline else { throw XCTSkip("timed out") }
            try await Task.sleep(for: .milliseconds(50))
        }
    }
}
