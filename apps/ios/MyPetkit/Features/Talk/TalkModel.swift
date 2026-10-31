@preconcurrency import AVFoundation
import Foundation
import Observation

/// Hold to talk: pressing opens a talk channel and streams the microphone;
/// releasing sends the rest and `talk_stop`. Half-duplex: the live view mutes
/// its player while `isActive`, because the device has no echo cancelling.
@MainActor
@Observable
final class TalkModel {
    enum State: Equatable {
        case idle
        case connecting
        case talking
        /// Released: the last audio and `talk_stop` are on their way.
        case stopping
        case failed(String)
    }

    nonisolated static let deniedSentence = "Turn on microphone access for MyPetKit in Settings to talk."

    let deviceID: Int
    private(set) var state: State

    @ObservationIgnored private var holding = false
    @ObservationIgnored private var run: Task<Void, Never>?
    @ObservationIgnored private var microphone: TalkMicrophone?

    init(deviceID: Int, state: State = .idle) {
        self.deviceID = deviceID
        self.state = state
    }

    /// The player stays muted until the device has played the tail.
    var isActive: Bool { state == .connecting || state == .talking || state == .stopping }

    var failure: String? {
        if case .failed(let message) = state { return message }
        return nil
    }

    func press(session: ServerSession) {
        guard !holding else { return }
        holding = true
        guard run == nil else { return }
        state = .connecting
        run = Task {
            await talk(session: session)
            run = nil
            // A press that landed while the last talk was still stopping is
            // dropped, so the next press starts cleanly.
            holding = false
        }
    }

    func release() {
        holding = false
        // Ending the microphone stream ends the send loop, which then stops.
        microphone?.stop()
    }

    /// Ends talk at once (the screen went away).
    func cancel() {
        release()
        run?.cancel()
    }

    private func talk(session: ServerSession) async {
        switch await Self.microphonePermission() {
        case .denied:
            holding = false
            state = .failed(Self.deniedSentence)
            return
        case .justGranted:
            // The prompt interrupted the hold; recording must start from a
            // press the person makes knowing the microphone is on.
            holding = false
            state = .idle
            return
        case .granted:
            break
        }
        guard holding else {
            state = .idle
            return
        }
        guard let url = URLSessionTalkSocket.url(baseURL: session.paired.address.baseURL, deviceID: deviceID) else {
            state = .failed(Self.message(for: URLError(.badURL)))
            return
        }
        let channel = TalkChannel(socket: URLSessionTalkSocket(session: session.urlSession, url: url,
                                                               token: session.paired.token))
        do {
            try await channel.start()
            guard holding, !Task.isCancelled else {
                state = .stopping
                await Self.finish(channel)
                state = .idle
                return
            }
            let microphone = TalkMicrophone()
            let pcm = try microphone.start()
            self.microphone = microphone
            state = .talking
            for await data in pcm {
                try await channel.send(pcm: data)
            }
            self.microphone = nil
            state = .stopping
            await Self.finish(channel)
            state = .idle
        } catch {
            microphone?.stop()
            microphone = nil
            await channel.close()
            holding = false
            state = Task.isCancelled ? .idle : .failed(Self.message(for: error))
        }
    }

    /// Ends a talk whose audio was all sent. The server answers `stopped`
    /// only after its encoder flushes, which can outlast our wait; the talk
    /// still worked, so a late or missing answer is not shown as a failure.
    private static func finish(_ channel: TalkChannel) async {
        do {
            try await channel.stop()
        } catch {
            await channel.close()
        }
    }

    private enum Permission { case granted, justGranted, denied }

    private static func microphonePermission() async -> Permission {
        switch AVAudioApplication.shared.recordPermission {
        case .granted: return .granted
        case .denied: return .denied
        default: return await AVAudioApplication.requestRecordPermission() ? .justGranted : .denied
        }
    }

    /// One sentence for a talk failure.
    nonisolated static func message(for error: any Error) -> String {
        switch error {
        case TalkError.refused(let reason) where !reason.isEmpty:
            "The server could not start talk: \(reason)."
        case TalkError.refused, TalkError.noAnswer:
            "The server did not start talk. Try again."
        case is TalkPCMError:
            "The microphone could not start on this phone."
        default:
            Loadable<Void>.message(for: error)
        }
    }
}
