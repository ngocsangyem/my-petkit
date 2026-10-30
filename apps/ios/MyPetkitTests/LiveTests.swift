import PetkitAPI
import XCTest
@testable import MyPetkit

final class LiveRulesTests: XCTestCase {
    func testOfferedKeepsServerOrderAndDropsMSE() {
        XCTAssertEqual(LiveMode.offered(["webrtc", "mse", "hls"]), [.webrtc, .hls])
        XCTAssertEqual(LiveMode.offered(["mse", "hls"]), [.hls])
        XCTAssertEqual(LiveMode.offered(["hls", "webrtc", "hls", "rtsp"]), [.hls, .webrtc])
        XCTAssertEqual(LiveMode.offered([]), [])
    }

    func testInitialPrefersThePersonsPickWhenOffered() {
        XCTAssertEqual(LiveMode.initial(offered: [.webrtc, .hls], preferred: nil), .webrtc)
        XCTAssertEqual(LiveMode.initial(offered: [.webrtc, .hls], preferred: .hls), .hls)
        XCTAssertEqual(LiveMode.initial(offered: [.hls], preferred: .webrtc), .hls)
        XCTAssertNil(LiveMode.initial(offered: [], preferred: .hls))
    }

    func testFallbackFromWebRTCIsHLS() {
        XCTAssertEqual(LiveMode.fallback(after: .webrtc, offered: [.webrtc, .hls]), .hls)
        XCTAssertNil(LiveMode.fallback(after: .webrtc, offered: [.webrtc]))
    }

    func testOnlyAConflictNamedWebRTCUnavailableDropsTheMode() {
        XCTAssertTrue(LiveMode.isWebRTCUnavailable(APIError(status: 409, code: "webrtc_unavailable", message: "")))
        XCTAssertFalse(LiveMode.isWebRTCUnavailable(APIError(status: 409, code: "stream_unavailable", message: "")))
        XCTAssertFalse(LiveMode.isWebRTCUnavailable(APIError(status: 502, code: "webrtc_unavailable", message: "")))
        XCTAssertFalse(LiveMode.isWebRTCUnavailable(URLError(.timedOut)))
    }

    func testUnavailableSentencePerReason() {
        XCTAssertEqual(LiveUnavailable.sentence(for: "not_a_camera"), "This device has no camera to watch.")
        XCTAssertEqual(LiveUnavailable.sentence(for: "device_unreachable"),
                       "The camera has not reported its address yet, so the server cannot reach it.")
        XCTAssertEqual(LiveUnavailable.sentence(for: "no_stream"), "The server has no stream set up for this camera yet.")
        XCTAssertEqual(LiveUnavailable.sentence(for: "sidecar_down"), "The server's video relay is not running right now.")
        XCTAssertEqual(LiveUnavailable.sentence(for: nil), "Live video is not available right now.")
        XCTAssertEqual(LiveUnavailable.sentence(for: "something_new"), "Live video is not available right now.")
    }

    func testTalkIsOfferedOnlyWhenTheDeviceCanBeReached() {
        XCTAssertFalse(LiveUnavailable.allowsTalk(reason: "not_a_camera"))
        XCTAssertFalse(LiveUnavailable.allowsTalk(reason: "device_unreachable"))
        XCTAssertTrue(LiveUnavailable.allowsTalk(reason: "sidecar_down"))
        XCTAssertTrue(LiveUnavailable.allowsTalk(reason: "no_stream"))
    }

    func testModeSentenceMentionsHLSOnlyWhenOffered() {
        XCTAssertEqual(LiveMode.webrtc.explanation(alternatives: [.hls]),
                       "WebRTC is under a second behind. Switch to HLS if the picture stalls; "
                           + "it is about 4 seconds behind but works on any network.")
        XCTAssertEqual(LiveMode.webrtc.explanation(alternatives: []), "WebRTC is under a second behind.")
        XCTAssertEqual(LiveMode.hls.explanation(alternatives: [.webrtc]),
                       "HLS is about 4 seconds behind but works on any network.")
    }
}

// MARK: Model

@MainActor
private final class FakeStream: LiveStream {
    let mode: LiveMode
    var onEvent: ((LiveStreamEvent) -> Void)?
    private(set) var muted = false
    private(set) var stopped = false

    init(mode: LiveMode) { self.mode = mode }

    func setMuted(_ muted: Bool) { self.muted = muted }
    func stop() { stopped = true }
}

@MainActor
private final class FakeBackend: LiveBackend {
    var availability: LiveAvailability
    var failures: [LiveMode: any Error] = [:]
    /// When set, `availability` waits until `answer()`.
    var holdsAnswer = false
    private var pending: CheckedContinuation<Void, Never>?
    private(set) var opened: [FakeStream] = []

    func answer() {
        pending?.resume()
        pending = nil
    }

    init(modes: [String], available: Bool = true, reason: String? = nil) {
        availability = LiveAvailability(available: available, reason: reason, modes: LiveMode.offered(modes),
                                        hlsPath: available ? "/api/live/1/stream.m3u8?exp=1&sig=x" : nil)
    }

    func availability(deviceID: Int) async throws -> LiveAvailability {
        if holdsAnswer {
            await withCheckedContinuation { pending = $0 }
        }
        return availability
    }

    func open(_ mode: LiveMode, deviceID: Int) async throws -> any LiveStream {
        if let error = failures[mode] { throw error }
        let stream = FakeStream(mode: mode)
        opened.append(stream)
        return stream
    }
}

@MainActor
final class LiveModelTests: XCTestCase {
    /// Lets the model's event hops run.
    private func settle() async {
        for _ in 0..<20 { await Task.yield() }
    }

    func testStartsWithTheServersFirstMode() async {
        let backend = FakeBackend(modes: ["webrtc", "mse", "hls"])
        let model = LiveModel(deviceID: 1)
        await model.start(backend)
        XCTAssertEqual(model.modes, [.webrtc, .hls])
        XCTAssertEqual(model.mode, .webrtc)
        XCTAssertEqual(model.phase, .connecting)
        XCTAssertTrue(model.talkAllowed)

        backend.opened.last?.onEvent?(.playing)
        await settle()
        XCTAssertEqual(model.phase, .playing)
    }

    func testConflictWebRTCUnavailableFallsBackToHLSAndDropsWebRTC() async {
        let backend = FakeBackend(modes: ["webrtc", "mse", "hls"])
        backend.failures[.webrtc] = APIError(status: 409, code: "webrtc_unavailable", message: "No WebRTC.")
        let model = LiveModel(deviceID: 1)
        await model.start(backend)
        XCTAssertEqual(model.mode, .hls)
        XCTAssertEqual(model.modes, [.hls])
        XCTAssertEqual(model.sentence, LiveUnavailable.webRTCMissing)
        XCTAssertEqual(backend.opened.map(\.mode), [.hls])
    }

    func testWebRTCThatNeverConnectsFallsBackButStaysSelectable() async {
        let backend = FakeBackend(modes: ["webrtc", "hls"])
        let model = LiveModel(deviceID: 1)
        await model.start(backend)
        let webrtc = backend.opened.last
        webrtc?.onEvent?(.failed(LiveStreamError.stopped))
        await settle()
        XCTAssertEqual(webrtc?.stopped, true)
        XCTAssertEqual(model.mode, .hls)
        XCTAssertEqual(model.modes, [.webrtc, .hls])
        XCTAssertEqual(model.sentence, LiveUnavailable.webRTCFailed)
    }

    func testAPictureThatDropsAfterPlayingOffersRetry() async {
        let backend = FakeBackend(modes: ["hls"])
        let model = LiveModel(deviceID: 1)
        await model.start(backend)
        backend.opened.last?.onEvent?(.playing)
        await settle()
        backend.opened.last?.onEvent?(.failed(LiveStreamError.stopped))
        await settle()
        XCTAssertEqual(model.phase, .failed("The live picture stopped."))
        XCTAssertNil(model.stream)
    }

    func testHLSFailureHasNoFallback() async {
        let backend = FakeBackend(modes: ["hls"])
        backend.failures[.hls] = LiveStreamError.stopped
        let model = LiveModel(deviceID: 1)
        await model.start(backend)
        XCTAssertEqual(model.phase, .failed("The live picture did not start."))
    }

    func testUnavailableKeepsTheReason() async {
        let backend = FakeBackend(modes: [], available: false, reason: "device_unreachable")
        let model = LiveModel(deviceID: 1)
        await model.start(backend)
        XCTAssertEqual(model.phase, .unavailable(reason: "device_unreachable"))
        XCTAssertFalse(model.talkAllowed)
        XCTAssertTrue(backend.opened.isEmpty)
    }

    func testSelectingSwitchesStreamAndIsRememberedOnRestart() async {
        let backend = FakeBackend(modes: ["webrtc", "hls"])
        let model = LiveModel(deviceID: 1)
        await model.start(backend)
        let first = backend.opened.last
        await model.select(.hls)
        XCTAssertEqual(first?.stopped, true)
        XCTAssertEqual(model.mode, .hls)
        await model.start(backend)
        XCTAssertEqual(model.mode, .hls)
    }

    func testLeavingWhileAskingOpensNothing() async {
        let backend = FakeBackend(modes: ["hls"])
        backend.holdsAnswer = true
        let model = LiveModel(deviceID: 1)
        model.restart(backend)
        await settle()
        model.leave()
        backend.answer()
        await settle()
        XCTAssertTrue(backend.opened.isEmpty)
        XCTAssertNil(model.stream)
    }

    func testAnEventFromAReplacedStreamIsIgnored() async {
        let backend = FakeBackend(modes: ["webrtc", "hls"])
        let model = LiveModel(deviceID: 1)
        await model.start(backend)
        let webrtc = backend.opened.last
        await model.select(.hls)
        let hls = backend.opened.last
        webrtc?.onEvent?(.failed(LiveStreamError.stopped))
        await settle()
        XCTAssertEqual(hls?.stopped, false)
        XCTAssertNil(model.notice)
        XCTAssertEqual(model.mode, .hls)
    }

    func testAStalledPictureIsNotLabelledLive() async {
        let backend = FakeBackend(modes: ["hls"])
        let model = LiveModel(deviceID: 1)
        await model.start(backend)
        let stream = backend.opened.last
        stream?.onEvent?(.playing)
        await settle()
        stream?.onEvent?(.waiting)
        await settle()
        XCTAssertEqual(model.phase, .connecting)
        stream?.onEvent?(.playing)
        await settle()
        XCTAssertEqual(model.phase, .playing)
    }

    func testFallbackNoticeClearsWhenHLSFailsToo() async {
        let backend = FakeBackend(modes: ["webrtc", "hls"])
        backend.failures[.webrtc] = URLError(.timedOut)
        backend.failures[.hls] = LiveStreamError.stopped
        let model = LiveModel(deviceID: 1)
        await model.start(backend)
        XCTAssertEqual(model.phase, .failed("The live picture did not start."))
        XCTAssertNil(model.notice)
    }

    func testMuteReachesTheCurrentAndTheNextStream() async {
        let backend = FakeBackend(modes: ["webrtc", "hls"])
        let model = LiveModel(deviceID: 1)
        await model.start(backend)
        model.setMuted(true)
        XCTAssertEqual(backend.opened.last?.muted, true)
        await model.select(.hls)
        XCTAssertEqual(backend.opened.last?.muted, true)
    }
}
