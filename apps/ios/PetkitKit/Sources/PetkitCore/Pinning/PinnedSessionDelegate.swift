import Foundation

/// Answers server-trust challenges with the pinned certificate and nothing
/// else. Any other host, or a certificate that does not match, is refused;
/// the system trust store is never consulted as a fallback.
public final class PinnedSessionDelegate: NSObject, URLSessionDelegate, Sendable {
    public let host: String
    public let pin: CertificatePin

    public init(host: String, pin: CertificatePin) {
        self.host = host.lowercased()
        self.pin = pin
    }

    public func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge
    ) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        evaluate(challenge)
    }

    func evaluate(
        _ challenge: URLAuthenticationChallenge
    ) -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        let space = challenge.protectionSpace
        guard space.authenticationMethod == NSURLAuthenticationMethodServerTrust else {
            return (.performDefaultHandling, nil)
        }
        guard space.host.lowercased() == host,
              let trust = space.serverTrust,
              pin.matches(trust)
        else { return (.cancelAuthenticationChallenge, nil) }
        return (.useCredential, URLCredential(trust: trust))
    }
}

public extension URLSession {
    /// An ephemeral session (no disk cache, no cookies persisted) pinned to
    /// one server certificate.
    static func pinned(host: String, pin: CertificatePin) -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.tlsMinimumSupportedProtocolVersion = .TLSv12
        return URLSession(
            configuration: configuration,
            delegate: PinnedSessionDelegate(host: host, pin: pin),
            delegateQueue: nil
        )
    }
}
