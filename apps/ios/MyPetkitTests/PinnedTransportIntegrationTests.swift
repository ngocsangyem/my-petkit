import AVFoundation
import Foundation
import PetkitCore
import XCTest

/// Runs inside the app host, so the app's App Transport Security settings
/// apply exactly as they will in production. Needs a user-plane TLS server:
/// pass `TEST_RUNNER_PETKIT_TEST_URL` (e.g. https://127.0.0.1:18443) and
/// `TEST_RUNNER_PETKIT_TEST_PIN` (its certificate's SHA-256) to xcodebuild.
/// Skipped without them.
final class PinnedTransportIntegrationTests: XCTestCase {
    private var base: URL!
    private var pin: CertificatePin!

    override func setUpWithError() throws {
        let env = ProcessInfo.processInfo.environment
        guard let url = env["PETKIT_TEST_URL"].flatMap(URL.init(string:)),
              let pin = env["PETKIT_TEST_PIN"].flatMap(CertificatePin.init(hex:))
        else { throw XCTSkip("no user-plane test server configured") }
        base = url
        self.pin = pin
    }

    func testPinnedSessionReachesSelfSignedServerUnderATS() async throws {
        let session = URLSession.pinned(host: try XCTUnwrap(base.host()), pin: pin)
        let (_, response) = try await session.data(from: base.appending(path: "api/ping"))
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
    }

    func testWrongPinIsRefused() async throws {
        let wrong = try XCTUnwrap(CertificatePin(hex: String(repeating: "00", count: 32)))
        let session = URLSession.pinned(host: try XCTUnwrap(base.host()), pin: wrong)
        do {
            _ = try await session.data(from: base.appending(path: "api/ping"))
            XCTFail("a certificate that does not match the pin was accepted")
        } catch let error as URLError {
            XCTAssertEqual(error.code, .cancelled)
        }
    }

    func testSystemTrustRejectsTheSelfSignedServer() async throws {
        do {
            _ = try await URLSession(configuration: .ephemeral).data(from: base.appending(path: "api/ping"))
            XCTFail("the system trusted a self-signed certificate")
        } catch is URLError {}
    }

    func testAVPlayerPlaysMP4ThroughThePinnedLoaderWithRanges() async throws {
        let loader = PinnedMediaLoader(host: try XCTUnwrap(base.host()), pin: pin)
        let asset = try XCTUnwrap(loader.asset(for: base.appending(path: "api/media/clip.mp4")))
        let (playable, duration) = try await asset.load(.isPlayable, .duration)
        XCTAssertTrue(playable)
        XCTAssertEqual(duration.seconds, 8, accuracy: 0.2)

        let item = AVPlayerItem(asset: asset)
        let player = AVPlayer(playerItem: item)
        let ready = expectation(description: "item ready to play")
        let observation = item.observe(\.status, options: [.initial, .new]) { item, _ in
            if item.status == .readyToPlay { ready.fulfill() }
        }
        await fulfillment(of: [ready], timeout: 15)
        observation.invalidate()
        await player.seek(to: CMTime(seconds: 6, preferredTimescale: 600))
        player.play()
        try await Task.sleep(for: .seconds(1))
        XCTAssertGreaterThan(player.currentTime().seconds, 6)
        XCTAssertNil(item.error)
        withExtendedLifetime(loader) {}
    }

    func testPlainHTTPSAssetFailsWithoutTheLoader() async throws {
        let asset = AVURLAsset(url: base.appending(path: "api/media/clip.mp4"))
        do {
            _ = try await asset.load(.duration)
            XCTFail("AVPlayer accepted a self-signed certificate on its own")
        } catch {}
    }
}
