import AVFoundation
import Foundation
import Observation
import PetkitAPI
import PetkitCore

/// Everything a screen needs to talk to the paired server: the generated
/// client over a session that trusts the server the way pairing decided, the
/// live event stream, media playback, and the step-up prompt for R3 calls.
@MainActor
@Observable
final class ServerSession {
    static let recentEventLimit = 500

    let paired: PairedServer
    let client: Client
    @ObservationIgnored let urlSession: URLSession
    @ObservationIgnored private let mediaLoader: PinnedMediaLoader?

    private(set) var connection: LiveConnection = .connecting
    /// Newest last, at most `recentEventLimit`.
    private(set) var recentEvents: [LiveEvent] = []
    /// The newest event, for screens that refresh on a kind (`media`, `event`).
    private(set) var lastEvent: LiveEvent?
    /// Set while an R3 call waits for the password; the root view presents it.
    var stepUp: StepUpRequest?
    /// Set when the server refused the token; the root view offers to pair again.
    private(set) var tokenRevoked = false

    init(paired: PairedServer) {
        self.paired = paired
        let address = paired.address
        urlSession = address.trust.session(host: address.host)
        let token = paired.token
        client = Client(address: address, session: urlSession, token: { token })
        if case .pinned(let pin) = address.trust {
            mediaLoader = PinnedMediaLoader(host: address.host, pin: pin)
        } else {
            mediaLoader = nil
        }
    }

    var serverName: String { paired.address.host }
    var isPinned: Bool { if case .pinned = paired.address.trust { true } else { false } }

    // MARK: Calls

    /// Runs `operation`; when the server answers `step_up_required`, asks for
    /// the password once and retries. A refused token flips `tokenRevoked`.
    func call<T: Sendable>(
        purpose: String = "Continue",
        _ operation: @escaping @MainActor () async throws -> T
    ) async throws -> T {
        do {
            return try await operation()
        } catch {
            guard let api = APIError.from(error) else { throw error }
            if api.isUnauthenticated { tokenRevoked = true }
            guard api.needsStepUp, await requestStepUp(purpose: purpose) else { throw api }
            do {
                return try await operation()
            } catch {
                throw APIError.from(error) ?? error
            }
        }
    }

    func requestStepUp(purpose: String) async -> Bool {
        stepUp?.finish(granted: false)
        return await withCheckedContinuation { continuation in
            stepUp = StepUpRequest(purpose: purpose, continuation: continuation)
        }
    }

    // MARK: Media

    /// A five-minute signed URL for a path under `/api/media/`.
    func signedMediaURL(path: String) async throws -> URL {
        let output = try await client.authMediaUrl(body: .json(.init(path: path)))
        let signed = try output.ok.body.json.url
        guard let url = URL(string: signed, relativeTo: paired.address.baseURL)?.absoluteURL else {
            throw URLError(.badURL)
        }
        return url
    }

    /// An asset that plays a signed media URL: through the pinned loader for
    /// a local server, directly for one with a system-trusted certificate.
    func playerAsset(for signedURL: URL) -> AVURLAsset? {
        if let mediaLoader { return mediaLoader.asset(for: signedURL) }
        return AVURLAsset(url: signedURL)
    }

    /// Image bytes (thumbnails, face photos) over the trusted session.
    func data(at url: URL) async throws -> Data {
        var request = URLRequest(url: url)
        request.setValue("Bearer \(paired.token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return data
    }

    /// An absolute URL for a server path such as `/api/media/thumb/...`.
    func url(forPath path: String) -> URL? {
        URL(string: path, relativeTo: paired.address.baseURL)?.absoluteURL
    }

    // MARK: Live events

    /// Reads the WebSocket until cancelled; call from a `.task` that runs
    /// only while the scene is active.
    func runLiveEvents() async {
        let token = paired.token
        let stream = LiveEventStream(baseURL: paired.address.baseURL, session: urlSession, token: { token })
        for await update in stream.updates() {
            switch update {
            case .connection(let state):
                connection = state
            case .event(let event):
                if let last = recentEvents.last?.seq, let seq = event.seq, seq <= last,
                   recentEvents.contains(where: { $0.seq == seq }) {
                    continue
                }
                recentEvents.append(event)
                if recentEvents.count > Self.recentEventLimit {
                    recentEvents.removeFirst(recentEvents.count - Self.recentEventLimit)
                }
                lastEvent = event
            }
        }
        connection = .disconnected
    }
}
