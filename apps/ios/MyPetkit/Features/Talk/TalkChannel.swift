import Foundation
import os

/// The few WebSocket operations the talk protocol needs, so the sequence can
/// be tested without a server.
protocol TalkSocket: Sendable {
    func send(text: String) async throws
    func send(data: Data) async throws
    /// The next text frame; binary frames are skipped (the server sends none).
    func receiveText() async throws -> String
    func close()
}

enum TalkError: Error, Equatable {
    /// The server answered with `{"type":"error","msg":...}`.
    case refused(String)
    /// No answer in time, or an answer out of sequence.
    case noAnswer
}

/// `/api/devices/{id}/talk`: `talk_start` (pcm_s16le) answered `talking`, then
/// binary PCM frames of `TalkAudioFormat.chunkBytes`, then `talk_stop`
/// answered `stopped`. One channel is one press of the button.
actor TalkChannel {
    static let answerTimeout: Duration = .seconds(5)

    private let socket: any TalkSocket
    private let timeout: Duration
    private var chunker = PCMChunker()
    private var isTalking = false

    init(socket: any TalkSocket, timeout: Duration = TalkChannel.answerTimeout) {
        self.socket = socket
        self.timeout = timeout
    }

    func start() async throws {
        try await socket.send(text: #"{"type":"talk_start","format":"pcm_s16le"}"#)
        try await expect("talking")
        isTalking = true
    }

    /// Queues `pcm` and sends every frame it completes.
    func send(pcm: Data) async throws {
        guard isTalking else { return }
        for chunk in chunker.append(pcm) {
            try await socket.send(data: chunk)
        }
    }

    /// Sends the last partial frame, then `talk_stop`, waits for `stopped` and
    /// closes. The socket closes even when the server never answers.
    func stop() async throws {
        defer { socket.close() }
        guard isTalking else { return }
        isTalking = false
        if let rest = chunker.flush() {
            try await socket.send(data: rest)
        }
        try await socket.send(text: #"{"type":"talk_stop"}"#)
        try await expect("stopped")
    }

    func close() {
        isTalking = false
        socket.close()
    }

    private func expect(_ type: String) async throws {
        let text = try await receive()
        let message = try? JSONDecoder().decode(TalkMessage.self, from: Data(text.utf8))
        switch message?.type {
        case type: return
        case "error": throw TalkError.refused(message?.msg ?? "")
        default: throw TalkError.noAnswer
        }
    }

    private func receive() async throws -> String {
        let socket = socket
        let timeout = timeout
        let timedOut = OSAllocatedUnfairLock(initialState: false)
        do {
            return try await withThrowingTaskGroup(of: String.self) { group in
                group.addTask { try await socket.receiveText() }
                group.addTask {
                    try await Task.sleep(for: timeout)
                    timedOut.withLock { $0 = true }
                    // A group waits for every child; closing is what ends a
                    // receive that does not answer cancellation.
                    socket.close()
                    throw TalkError.noAnswer
                }
                defer { group.cancelAll() }
                guard let first = try await group.next() else { throw TalkError.noAnswer }
                return first
            }
        } catch {
            // The close above fails the receive too, possibly first.
            if timedOut.withLock({ $0 }) { throw TalkError.noAnswer }
            throw error
        }
    }
}

private struct TalkMessage: Decodable {
    let type: String
    let msg: String?
}

/// `TalkSocket` over a `URLSessionWebSocketTask` from the paired session, so
/// the upgrade is pinned like every other request and carries the token.
final class URLSessionTalkSocket: TalkSocket {
    private let task: URLSessionWebSocketTask

    init(session: URLSession, url: URL, token: String) {
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        task = session.webSocketTask(with: request)
        task.resume()
    }

    /// `wss://host/api/devices/{id}/talk` for a server's base URL.
    static func url(baseURL: URL, deviceID: Int) -> URL? {
        var parts = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        parts?.scheme = baseURL.scheme == "http" ? "ws" : "wss"
        parts?.path = "/api/devices/\(deviceID)/talk"
        parts?.query = nil
        return parts?.url
    }

    func send(text: String) async throws { try await task.send(.string(text)) }
    func send(data: Data) async throws { try await task.send(.data(data)) }

    func receiveText() async throws -> String {
        let task = task
        return try await withTaskCancellationHandler {
            while true {
                if case .string(let text) = try await task.receive() { return text }
            }
        } onCancel: {
            task.cancel(with: .goingAway, reason: nil)
        }
    }

    func close() { task.cancel(with: .normalClosure, reason: nil) }
}
