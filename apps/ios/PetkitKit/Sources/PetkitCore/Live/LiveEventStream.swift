import Foundation

/// Reads `GET /api/ws` while the app is in the foreground and reconnects with
/// backoff. The server pings every 25 s; 60 s of silence counts as a drop.
/// The bearer token rides in the upgrade request; no `Origin` is sent, which
/// the server allows for token clients.
public final class LiveEventStream: Sendable {
    static let silenceLimit: Duration = .seconds(60)
    static let maxBackoff: Duration = .seconds(30)

    private let url: URL
    private let session: URLSession
    private let token: @Sendable () -> String?

    public init(baseURL: URL, session: URLSession, token: @escaping @Sendable () -> String?) {
        var parts = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        parts?.scheme = "wss"
        parts?.path = "/api/ws"
        url = parts?.url ?? baseURL
        self.session = session
        self.token = token
    }

    /// Events and connection changes until the consuming task is cancelled.
    public func updates() -> AsyncStream<Update> {
        AsyncStream { continuation in
            let task = Task { await run(continuation) }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    public enum Update: Sendable {
        case connection(LiveConnection)
        case event(LiveEvent)
    }

    private func run(_ continuation: AsyncStream<Update>.Continuation) async {
        var backoff: Duration = .seconds(1)
        while !Task.isCancelled {
            continuation.yield(.connection(.connecting))
            var request = URLRequest(url: url)
            if let token = token() {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            let socket = session.webSocketTask(with: request)
            socket.resume()
            var announced = false
            do {
                while !Task.isCancelled {
                    let message = try await receive(socket)
                    if !announced {
                        announced = true
                        backoff = .seconds(1)
                        continuation.yield(.connection(.live))
                    }
                    guard case .string(let text) = message,
                          let event = try? JSONDecoder().decode(LiveEvent.self, from: Data(text.utf8)),
                          !event.isPing
                    else { continue }
                    continuation.yield(.event(event))
                }
            } catch {}
            socket.cancel(with: .goingAway, reason: nil)
            continuation.yield(.connection(.disconnected))
            try? await Task.sleep(for: backoff)
            backoff = min(backoff * 2, Self.maxBackoff)
        }
        continuation.finish()
    }

    /// The next message, or a timeout error after `silenceLimit`.
    private func receive(_ socket: URLSessionWebSocketTask) async throws -> URLSessionWebSocketTask.Message {
        try await withThrowingTaskGroup(of: URLSessionWebSocketTask.Message.self) { group in
            group.addTask { try await socket.receive() }
            group.addTask {
                try await Task.sleep(for: Self.silenceLimit)
                throw URLError(.timedOut)
            }
            defer { group.cancelAll() }
            guard let first = try await group.next() else { throw URLError(.cancelled) }
            return first
        }
    }
}
