import Foundation
import Observation
import PetkitAPI

/// What the live screen needs from the server, behind a protocol so the mode
/// choice and fallback can be tested without one.
@MainActor
protocol LiveBackend {
    func availability(deviceID: Int) async throws -> LiveAvailability
    func open(_ mode: LiveMode, deviceID: Int) async throws -> any LiveStream
}

/// The paired server, through the generated client and the pinned session.
@MainActor
struct ServerLiveBackend: LiveBackend {
    let session: ServerSession

    func availability(deviceID: Int) async throws -> LiveAvailability {
        let info = try await session.client.getLiveInfo(path: .init(id: deviceID)).ok.body.json
        let reason = info.reason.flatMap { $0 == ._empty_ ? nil : $0.rawValue }
        return LiveAvailability(available: info.available, reason: reason,
                                modes: LiveMode.offered(info.modes.map(\.rawValue)), hlsPath: info.hlsUrl)
    }

    func open(_ mode: LiveMode, deviceID: Int) async throws -> any LiveStream {
        switch mode {
        case .webrtc:
            let client = session.client
            return try await WebRTCLiveStream.open { offer in
                try await client.postLiveWebrtcOffer(path: .init(id: deviceID),
                                                     body: .json(.init(_type: .offer, sdp: offer)))
                    .ok.body.json.sdp
            }
        case .hls:
            // The signed link lasts five minutes, so each start asks for a fresh one.
            let fresh = try await availability(deviceID: deviceID)
            guard let path = fresh.hlsPath, let url = session.url(forPath: path) else {
                throw LiveStreamError.stopped
            }
            return try await HLSLiveStream.open(remote: url, session: session)
        }
    }
}

/// The live screen's state: availability, the chosen mode, the running
/// stream, and the fallback from WebRTC to HLS.
@MainActor
@Observable
final class LiveModel {
    enum Phase: Equatable {
        case loading
        case unavailable(reason: String?)
        case connecting
        case playing
        case failed(String)
    }

    let deviceID: Int
    private(set) var phase: Phase
    private(set) var modes: [LiveMode]
    private(set) var mode: LiveMode?
    /// Replaces the mode sentence after a fallback.
    private(set) var notice: String?
    private(set) var talkAllowed: Bool
    private(set) var stream: (any LiveStream)?

    @ObservationIgnored private var backend: (any LiveBackend)?
    @ObservationIgnored private var preferred: LiveMode?
    @ObservationIgnored private var muted = false
    /// Bumped on every open and stop, so a slow open that lost the race is dropped.
    @ObservationIgnored private var generation = 0
    /// The retry or switch the person started; `leave()` cancels it.
    @ObservationIgnored private var loadTask: Task<Void, Never>?

    init(deviceID: Int, phase: Phase = .loading, modes: [LiveMode] = [], mode: LiveMode? = nil,
         talkAllowed: Bool = false) {
        self.deviceID = deviceID
        self.phase = phase
        self.modes = modes
        self.mode = mode
        self.talkAllowed = talkAllowed
    }

    var sentence: String? {
        if let notice { return notice }
        guard let mode else { return nil }
        return mode.explanation(alternatives: modes.filter { $0 != mode })
    }

    func start(_ backend: any LiveBackend) async {
        self.backend = backend
        stop()
        let attempt = generation
        phase = .loading
        notice = nil
        do {
            let info = try await backend.availability(deviceID: deviceID)
            // Left, backgrounded or restarted while asking.
            guard attempt == generation, !Task.isCancelled else { return }
            talkAllowed = info.available || LiveUnavailable.allowsTalk(reason: info.reason)
            modes = info.available ? info.modes : []
            guard let first = LiveMode.initial(offered: modes, preferred: preferred) else {
                phase = .unavailable(reason: info.available ? nil : info.reason)
                return
            }
            await open(first)
        } catch is CancellationError {
            return
        } catch {
            phase = .failed(Loadable<Void>.message(for: error))
        }
    }

    /// The person picked `mode` in the segmented control.
    func select(_ mode: LiveMode) async {
        guard mode != self.mode, modes.contains(mode) else { return }
        preferred = mode
        notice = nil
        await open(mode)
    }

    /// Retry, as a task that `leave()` cancels.
    func restart(_ backend: any LiveBackend) {
        loadTask?.cancel()
        loadTask = Task { await start(backend) }
    }

    /// A segmented-control pick, as a task that `leave()` cancels.
    func choose(_ mode: LiveMode) {
        loadTask?.cancel()
        loadTask = Task { await select(mode) }
    }

    /// The screen went away or to the background: nothing may open after this.
    func leave() {
        loadTask?.cancel()
        loadTask = nil
        stop()
    }

    func setMuted(_ muted: Bool) {
        self.muted = muted
        stream?.setMuted(muted)
    }

    func stop() {
        generation += 1
        stream?.onEvent = nil
        stream?.stop()
        stream = nil
    }

    private func open(_ mode: LiveMode) async {
        guard let backend else { return }
        stop()
        let attempt = generation
        self.mode = mode
        phase = .connecting
        do {
            let opened = try await backend.open(mode, deviceID: deviceID)
            guard attempt == generation, !Task.isCancelled else { return opened.stop() }
            opened.onEvent = { [weak self, weak opened] event in
                guard let self, let opened else { return }
                Task { await self.handle(event, from: opened) }
            }
            opened.setMuted(muted)
            stream = opened
        } catch is CancellationError {
            return
        } catch {
            guard attempt == generation else { return }
            await failed(mode, error: error)
        }
    }

    private func handle(_ event: LiveStreamEvent, from source: any LiveStream) async {
        // Checked here, not in the callback: a switch may land in between.
        guard source === stream else { return }
        let mode = source.mode
        switch event {
        case .playing:
            if phase == .connecting { phase = .playing }
        case .waiting:
            // A stalled live picture is not live: drop the label, show progress.
            if phase == .playing { phase = .connecting }
        case .failed(let error):
            // A WebRTC picture that never arrived falls back; one that ran
            // and dropped is offered a retry instead.
            if phase == .connecting {
                stop()
                await failed(mode, error: error)
            } else {
                stop()
                phase = .failed(L10n.string("The live picture stopped."))
            }
        }
    }

    private func failed(_ mode: LiveMode, error: any Error) async {
        guard mode == .webrtc, let next = LiveMode.fallback(after: mode, offered: modes) else {
            notice = nil
            phase = .failed(Self.message(for: error))
            return
        }
        if LiveMode.isWebRTCUnavailable(error) {
            modes.removeAll { $0 == .webrtc }
            notice = LiveUnavailable.webRTCMissing
        } else {
            notice = LiveUnavailable.webRTCFailed
        }
        await open(next)
    }

    nonisolated static func message(for error: any Error) -> String {
        if error is LiveStreamError { return L10n.string("The live picture did not start.") }
        return Loadable<Void>.message(for: error)
    }
}
