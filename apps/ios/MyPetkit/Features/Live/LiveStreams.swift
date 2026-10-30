import AVFoundation
import Foundation
import PetkitLive

enum LiveStreamEvent {
    case playing
    /// Buffering after it had played (HLS only).
    case waiting
    case failed(any Error)
}

enum LiveStreamError: Error {
    /// The picture stopped after it had started, or never arrived.
    case stopped
}

/// One running way of watching. The model owns it and stops it on leave.
@MainActor
protocol LiveStream: AnyObject {
    var mode: LiveMode { get }
    var onEvent: ((LiveStreamEvent) -> Void)? { get set }
    func setMuted(_ muted: Bool)
    func stop()
}

/// HLS through AVPlayer. A pinned server goes through `LiveHLSProxy`; one
/// with a system-trusted certificate is played directly.
@MainActor
final class HLSLiveStream: LiveStream {
    let mode = LiveMode.hls
    let player: AVPlayer
    var onEvent: ((LiveStreamEvent) -> Void)?

    private let proxy: LiveHLSProxy?
    private var observations: [NSKeyValueObservation] = []

    init(url: URL, proxy: LiveHLSProxy?) {
        self.proxy = proxy
        let item = AVPlayerItem(url: url)
        // Live: keep the buffer short so the picture stays close to now.
        item.preferredForwardBufferDuration = 1
        player = AVPlayer(playerItem: item)
        observations = [
            item.observe(\.status) { [weak self] item, _ in
                guard item.status == .failed else { return }
                Task { @MainActor in self?.onEvent?(.failed(LiveStreamError.stopped)) }
            },
            player.observe(\.timeControlStatus) { [weak self] player, _ in
                let event: LiveStreamEvent? = switch player.timeControlStatus {
                case .playing: .playing
                case .waitingToPlayAtSpecifiedRate: .waiting
                default: nil
                }
                guard let event else { return }
                Task { @MainActor in self?.onEvent?(event) }
            },
        ]
        player.play()
    }

    /// Opens `remote` (an absolute signed master playlist URL) for `session`.
    static func open(remote: URL, session: ServerSession) async throws -> HLSLiveStream {
        // Live sound plays with the silent switch on, like any video.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        guard session.isPinned else { return HLSLiveStream(url: remote, proxy: nil) }
        let urlSession = session.urlSession
        let proxy = try LiveHLSProxy(upstream: session.paired.address.baseURL) { request in
            try await urlSession.data(for: request)
        }
        try await proxy.start()
        guard let local = proxy.localURL(for: remote) else {
            proxy.stop()
            throw URLError(.badURL)
        }
        return HLSLiveStream(url: local, proxy: proxy)
    }

    func setMuted(_ muted: Bool) {
        player.isMuted = muted
    }

    func stop() {
        observations.removeAll()
        player.pause()
        player.replaceCurrentItem(with: nil)
        proxy?.stop()
    }
}

/// WebRTC through `WebRTCReceiver`, signaled over the pinned session.
@MainActor
final class WebRTCLiveStream: LiveStream {
    /// How long ICE may take after the answer before HLS is the better bet.
    static let connectTimeout: Duration = .seconds(10)

    let mode = LiveMode.webrtc
    let receiver: WebRTCReceiver
    var onEvent: ((LiveStreamEvent) -> Void)?
    private var watchdog: Task<Void, Never>?

    private init(receiver: WebRTCReceiver) {
        self.receiver = receiver
        receiver.onState = { [weak self] state in self?.changed(state) }
    }

    /// Gathers, posts the offer, applies the answer. Throws the server's
    /// refusal as is, so a 409 `webrtc_unavailable` reaches the fallback.
    static func open(answer: (String) async throws -> String) async throws -> WebRTCLiveStream {
        let receiver = WebRTCReceiver()
        let stream = WebRTCLiveStream(receiver: receiver)
        do {
            let offer = try await receiver.makeOffer()
            try Task.checkCancellation()
            try await receiver.accept(answer: answer(offer))
        } catch {
            receiver.close()
            throw error
        }
        stream.watch()
        return stream
    }

    func setMuted(_ muted: Bool) {
        receiver.setAudioEnabled(!muted)
    }

    func stop() {
        watchdog?.cancel()
        receiver.onState = nil
        receiver.close()
    }

    private func watch() {
        watchdog = Task { [weak self] in
            try? await Task.sleep(for: Self.connectTimeout)
            guard !Task.isCancelled, let self, self.receiver.state == .connecting else { return }
            self.onEvent?(.failed(LiveStreamError.stopped))
        }
    }

    private func changed(_ state: WebRTCReceiver.State) {
        switch state {
        case .connected:
            watchdog?.cancel()
            onEvent?(.playing)
        case .failed:
            watchdog?.cancel()
            onEvent?(.failed(LiveStreamError.stopped))
        case .connecting, .closed:
            break
        }
    }
}
