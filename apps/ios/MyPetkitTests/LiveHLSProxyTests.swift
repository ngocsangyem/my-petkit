import AVFoundation
import XCTest
@testable import MyPetkit

/// The loopback proxy that lets AVPlayer play live HLS from a pinned server.
@MainActor
final class LiveHLSProxyTests: XCTestCase {
    private let upstream = URL(string: "https://192.168.1.20:8443")
    private let prefix = "/3f2a"

    func testForwardsOnlyLivePathsUnderThePrefix() throws {
        let base = try XCTUnwrap(upstream)
        func resolve(_ target: String) -> String? {
            LiveHLSProxy.upstreamURL(target: target, prefix: prefix, upstream: base)?.absoluteString
        }
        XCTAssertEqual(resolve("/3f2a/api/live/7/hls/segment.ts?id=abc&n=3&exp=1&sig=x"),
                       "https://192.168.1.20:8443/api/live/7/hls/segment.ts?id=abc&n=3&exp=1&sig=x")
        XCTAssertNil(resolve("/api/live/7/stream.m3u8"), "no prefix")
        XCTAssertNil(resolve("/3f2b/api/live/7/stream.m3u8"), "wrong prefix")
        XCTAssertNil(resolve("/3f2a/api/devices"), "outside /api/live/")
        XCTAssertNil(resolve("/3f2a/api/live/../devices"), "dot segments")
        XCTAssertNil(resolve("/3f2a/api/live/%2e%2e/devices"), "encoded dot segments")
        XCTAssertNil(resolve("/3f2a//evil.example/api/live/7/stream.m3u8"), "another host")
    }

    func testParsesTheRequestLine() {
        let head = Data("GET /3f2a/api/live/7/stream.m3u8?exp=1 HTTP/1.1\r\nHost: 127.0.0.1\r\n".utf8)
        let parsed = LiveHLSProxy.requestTarget(head: head)
        XCTAssertEqual(parsed?.method, "GET")
        XCTAssertEqual(parsed?.target, "/3f2a/api/live/7/stream.m3u8?exp=1")
        XCTAssertNil(LiveHLSProxy.requestTarget(head: Data("garbage".utf8)))
    }

    /// The paired server, as fixture files with go2rtc's names and the
    /// server's content types. Records every URL it was asked for.
    private final class FixtureServer: @unchecked Sendable {
        private let lock = NSLock()
        private var asked: [URL] = []
        var requests: [URL] { lock.withLock { asked } }

        func fetch(_ request: URLRequest) throws -> (Data, URLResponse) {
            let url = try XCTUnwrap(request.url)
            lock.withLock { asked.append(url) }
            let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
            let (name, type): (String, String) = switch url.lastPathComponent {
            case "stream.m3u8": ("live-master.m3u8", "application/vnd.apple.mpegurl")
            case "playlist.m3u8": ("live-media.m3u8", "application/vnd.apple.mpegurl")
            case "segment.ts": ("live-segment-\(query.first { $0.name == "n" }?.value ?? "").bin", "video/mp2t")
            default: ("", "")
            }
            let bundle = Bundle(for: LiveHLSProxyTests.self)
            guard let file = bundle.url(forResource: name, withExtension: nil), let body = try? Data(contentsOf: file),
                  let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                                 headerFields: ["Content-Type": type])
            else {
                return (Data(), HTTPURLResponse(url: url, statusCode: 404, httpVersion: nil, headerFields: nil) ?? URLResponse())
            }
            return (body, response)
        }
    }

    private func makeProxy(_ server: FixtureServer) async throws -> LiveHLSProxy {
        let proxy = try LiveHLSProxy(upstream: XCTUnwrap(upstream)) { request in try server.fetch(request) }
        try await proxy.start()
        return proxy
    }

    func testServesThroughTheFetchAndRefusesEverythingElse() async throws {
        let server = FixtureServer()
        let proxy = try await makeProxy(server)
        defer { proxy.stop() }
        let playlistURL = try XCTUnwrap(URL(string: "https://192.168.1.20:8443/api/live/7/stream.m3u8?exp=1&sig=x"))
        let local = try XCTUnwrap(proxy.localURL(for: playlistURL))
        XCTAssertEqual(local.host, "127.0.0.1")

        let (body, response) = try await URLSession.shared.data(from: local)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        XCTAssertEqual((response as? HTTPURLResponse)?.mimeType, "application/vnd.apple.mpegurl")
        XCTAssertTrue(String(bytes: body, encoding: .utf8)?.contains("hls/playlist.m3u8?id=abc") == true)
        XCTAssertEqual(server.requests, [playlistURL])

        var unprefixed = try XCTUnwrap(URLComponents(url: local, resolvingAgainstBaseURL: false))
        unprefixed.path = "/api/live/7/stream.m3u8"
        let (_, refused) = try await URLSession.shared.data(from: XCTUnwrap(unprefixed.url))
        XCTAssertEqual((refused as? HTTPURLResponse)?.statusCode, 404)

        var post = URLRequest(url: local)
        post.httpMethod = "POST"
        let (_, notAllowed) = try await URLSession.shared.data(for: post)
        XCTAssertEqual((notAllowed as? HTTPURLResponse)?.statusCode, 405)
        XCTAssertEqual(server.requests.count, 1, "refused requests never reach the server")
    }

    /// AVPlayer refuses media segments from a resource loader; through the
    /// proxy it plays master, media playlist and segments end to end.
    func testAVPlayerPlaysLiveHLSThroughTheProxy() async throws {
        let server = FixtureServer()
        let proxy = try await makeProxy(server)
        defer { proxy.stop() }
        let playlistURL = try XCTUnwrap(URL(string: "https://192.168.1.20:8443/api/live/7/stream.m3u8?exp=1&sig=x"))
        let stream = HLSLiveStream(url: try XCTUnwrap(proxy.localURL(for: playlistURL)), proxy: nil)
        defer { stream.stop() }
        stream.setMuted(true)

        var played = 0.0
        for _ in 0..<100 where played < 1 {
            try await Task.sleep(for: .milliseconds(100))
            XCTAssertNotEqual(stream.player.currentItem?.status, .failed,
                              String(describing: stream.player.currentItem?.error))
            played = stream.player.currentTime().seconds
        }
        XCTAssertGreaterThanOrEqual(played, 1)
        let names = server.requests.map(\.lastPathComponent)
        XCTAssertEqual(names.prefix(2), ["stream.m3u8", "playlist.m3u8"])
        XCTAssertTrue(names.contains("segment.ts"))
        XCTAssertTrue(server.requests.allSatisfy { $0.host == "192.168.1.20" && $0.query?.contains("sig=x") == true })
    }
}
