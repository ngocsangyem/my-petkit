import Foundation
import Security

/// Reads the certificate a server presents, without trusting it and without
/// sending a request body: the TLS handshake is cancelled as soon as the leaf
/// certificate is in hand. Used when an address is typed by hand, so the
/// user can compare the fingerprint with the one in the server's log before
/// the app pins it.
public enum CertificateProbe {
    public static func pin(for baseURL: URL, timeout: TimeInterval = 10) async throws -> CertificatePin {
        let delegate = ProbeDelegate()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = timeout
        let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        var request = URLRequest(url: baseURL.appending(path: "api/info"))
        request.httpMethod = "HEAD"
        _ = try? await session.data(for: request)
        guard let pin = delegate.pin else { throw URLError(.cannotConnectToHost) }
        return pin
    }
}

private final class ProbeDelegate: NSObject, URLSessionDelegate, @unchecked Sendable {
    private let lock = NSLock()
    private var captured: CertificatePin?

    var pin: CertificatePin? { lock.withLock { captured } }

    func urlSession(
        _ session: URLSession, didReceive challenge: URLAuthenticationChallenge
    ) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        if let trust = challenge.protectionSpace.serverTrust,
           let leaf = (SecTrustCopyCertificateChain(trust) as? [SecCertificate])?.first {
            let pin = CertificatePin(certificateDER: SecCertificateCopyData(leaf) as Data)
            lock.withLock { captured = pin }
        }
        return (.cancelAuthenticationChallenge, nil)
    }
}

public extension CertificatePin {
    /// The fingerprint in groups of four upper-case hex digits, for comparing by eye.
    var grouped: [String] {
        let upper = hex.uppercased()
        return stride(from: 0, to: upper.count, by: 4).map {
            let start = upper.index(upper.startIndex, offsetBy: $0)
            return String(upper[start..<upper.index(start, offsetBy: 4)])
        }
    }
}
