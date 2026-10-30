import Foundation
import Network

/// Plays live HLS from a server with a pinned self-signed certificate.
///
/// AVPlayer's own networking cannot be pinned, and its resource loader serves
/// playlists but refuses media segments ("custom url not redirect",
/// CoreMediaErrorDomain -12881). So AVPlayer reads plain HTTP from this
/// listener on 127.0.0.1 instead, and every request is fetched over the
/// pinned session. Only the paired server's `/api/live/` paths are forwarded,
/// and only under a random path prefix, so another process on the phone that
/// finds the port cannot use it to reach anything.
final class LiveHLSProxy: @unchecked Sendable {
    typealias Fetch = @Sendable (URLRequest) async throws -> (Data, URLResponse)

    static let maxRequestHead = 8 * 1024

    private let upstream: URL
    private let prefix: String
    private let fetch: Fetch
    private let queue = DispatchQueue(label: "my-petkit.live-hls-proxy")
    private let listener: NWListener

    /// `upstream` is the paired server's base URL; `fetch` loads over its
    /// pinned session.
    init(upstream: URL, fetch: @escaping Fetch) throws {
        self.upstream = upstream
        self.fetch = fetch
        prefix = "/" + UUID().uuidString.lowercased()
        let parameters = NWParameters.tcp
        // Bound to loopback, so nothing off the phone can connect. Not
        // `acceptLocalOnly`: it refuses AVPlayer's own loader process.
        parameters.requiredLocalEndpoint = .hostPort(host: .ipv4(.loopback), port: .any)
        listener = try NWListener(using: parameters)
    }

    deinit {
        listener.cancel()
    }

    /// Starts listening and resolves once the port is known.
    func start() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let resumed = ResumeOnce(continuation)
            listener.stateUpdateHandler = { state in
                switch state {
                case .ready: resumed.resume(with: .success(()))
                case .failed(let error): resumed.resume(with: .failure(error))
                case .cancelled: resumed.resume(with: .failure(CancellationError()))
                default: break
                }
            }
            listener.newConnectionHandler = { [weak self] connection in self?.serve(connection) }
            listener.start(queue: queue)
        }
    }

    func stop() {
        listener.cancel()
    }

    /// The loopback URL AVPlayer should open for an upstream server URL.
    func localURL(for remote: URL) -> URL? {
        guard let port = listener.port?.rawValue, port != 0,
              var parts = URLComponents(url: remote, resolvingAgainstBaseURL: false)
        else { return nil }
        parts.scheme = "http"
        parts.host = "127.0.0.1"
        parts.port = Int(port)
        parts.percentEncodedPath = prefix + parts.percentEncodedPath
        return parts.url
    }

    /// The server URL for a request target such as
    /// `/<prefix>/api/live/1/hls/segment.ts?id=..&n=..`, or nil when the
    /// target is outside the prefix or outside `/api/live/`.
    static func upstreamURL(target: String, prefix: String, upstream: URL) -> URL? {
        guard target.hasPrefix(prefix + "/") else { return nil }
        let rest = String(target.dropFirst(prefix.count))
        // Dot segments are checked decoded, so `%2e%2e` cannot climb out either.
        guard let parts = URLComponents(string: rest),
              parts.host == nil, parts.scheme == nil,
              !parts.path.split(separator: "/").contains(where: { $0 == ".." || $0 == "." }),
              parts.path.hasPrefix("/api/live/"),
              var base = URLComponents(url: upstream, resolvingAgainstBaseURL: false)
        else { return nil }
        base.percentEncodedPath = parts.percentEncodedPath
        base.percentEncodedQuery = parts.percentEncodedQuery
        return base.url
    }

    /// `GET <target> HTTP/1.1` from a request head, or nil.
    static func requestTarget(head: Data) -> (method: String, target: String)? {
        guard let text = String(data: head, encoding: .utf8),
              let line = text.split(separator: "\r\n", maxSplits: 1).first
        else { return nil }
        let words = line.split(separator: " ")
        guard words.count == 3, words[2].hasPrefix("HTTP/1.") else { return nil }
        return (String(words[0]), String(words[1]))
    }

    // MARK: Connections

    private func serve(_ connection: NWConnection) {
        connection.start(queue: queue)
        readHead(connection, buffer: Data())
    }

    private func readHead(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: Self.maxRequestHead) { [weak self] data, _, done, error in
            guard let self else { return connection.cancel() }
            var buffer = buffer
            if let data { buffer.append(data) }
            if let end = buffer.range(of: Data("\r\n\r\n".utf8)) {
                self.answer(connection, head: buffer.subdata(in: buffer.startIndex..<end.lowerBound))
            } else if error != nil || done || buffer.count > Self.maxRequestHead {
                connection.cancel()
            } else {
                self.readHead(connection, buffer: buffer)
            }
        }
    }

    private func answer(_ connection: NWConnection, head: Data) {
        guard let (method, target) = Self.requestTarget(head: head) else {
            return respond(connection, status: 400, type: nil, body: Data())
        }
        guard method == "GET" else { return respond(connection, status: 405, type: nil, body: Data()) }
        guard let url = Self.upstreamURL(target: target, prefix: prefix, upstream: upstream) else {
            return respond(connection, status: 404, type: nil, body: Data())
        }
        let fetch = fetch
        // Strong self: the request is short (15 s at most) and its connection
        // must be answered and closed even if the stream stopped meanwhile.
        Task {
            var request = URLRequest(url: url)
            request.timeoutInterval = 15
            do {
                let (body, response) = try await fetch(request)
                let http = response as? HTTPURLResponse
                self.respond(connection, status: http?.statusCode ?? 502, type: http?.mimeType, body: body)
            } catch {
                self.respond(connection, status: 502, type: nil, body: Data())
            }
        }
    }

    private func respond(_ connection: NWConnection, status: Int, type: String?, body: Data) {
        var head = "HTTP/1.1 \(status) \(HTTPURLResponse.localizedString(forStatusCode: status).capitalized)\r\n"
        if let type { head += "Content-Type: \(type)\r\n" }
        head += "Content-Length: \(body.count)\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"
        connection.send(content: Data(head.utf8) + body, completion: .contentProcessed { _ in connection.cancel() })
    }
}

/// Resumes a continuation the first time only; listener states repeat.
private final class ResumeOnce: @unchecked Sendable {
    private var continuation: CheckedContinuation<Void, Error>?
    private let lock = NSLock()

    init(_ continuation: CheckedContinuation<Void, Error>) {
        self.continuation = continuation
    }

    func resume(with result: Result<Void, Error>) {
        lock.lock()
        let pending = continuation
        continuation = nil
        lock.unlock()
        pending?.resume(with: result)
    }
}
