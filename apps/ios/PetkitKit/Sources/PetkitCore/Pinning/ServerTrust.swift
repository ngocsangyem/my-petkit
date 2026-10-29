import Foundation

/// How the app decides a server is the one it paired with.
///
/// App Transport Security lets a delegate pin a self-signed certificate only
/// for IP literals and local names (`.local`, or a single label such as
/// `homeassistant`); for any other DNS name it demands system trust first and
/// never asks the delegate. So a local server reached by address is pinned to
/// the certificate in the pairing QR code, and a server reached by a public
/// name (Tailscale `*.ts.net`, a cloud domain) must present a certificate the
/// system trusts. See apps/ios/SPIKE.md.
public enum ServerTrust: Sendable, Hashable, Codable {
    case pinned(CertificatePin)
    case system

    /// The trust a server at `host` needs, or nil when it needs a pin and
    /// none was given.
    public static func required(forHost host: String, pin: CertificatePin?) -> ServerTrust? {
        guard isLocal(host) else { return .system }
        return pin.map(ServerTrust.pinned)
    }

    /// True for the hosts ATS exempts from system trust.
    public static func isLocal(_ host: String) -> Bool {
        let name = host.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "[]."))
        if name.isEmpty { return false }
        if isIPLiteral(name) { return true }
        return name.hasSuffix(".local") || !name.contains(".")
    }

    static func isIPLiteral(_ name: String) -> Bool {
        var v4 = in_addr()
        var v6 = in6_addr()
        return inet_pton(AF_INET, name, &v4) == 1 || inet_pton(AF_INET6, name, &v6) == 1
    }

    /// A URLSession for this trust: ephemeral, never caching a response to disk.
    public func session(host: String) -> URLSession {
        switch self {
        case .pinned(let pin):
            return .pinned(host: host, pin: pin)
        case .system:
            let configuration = URLSessionConfiguration.ephemeral
            configuration.urlCache = nil
            configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
            configuration.tlsMinimumSupportedProtocolVersion = .TLSv12
            return URLSession(configuration: configuration)
        }
    }
}

extension CertificatePin: Codable {
    public init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer().decode(String.self)
        guard let pin = CertificatePin(hex: value) else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath,
                                                    debugDescription: "not a SHA-256 fingerprint"))
        }
        self = pin
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(hex)
    }
}
