import Foundation

/// What the pairing QR code carries: `{url, cert_sha256, code}`
/// (`features/auth/pairing.py::qr_payload`).
public struct PairingPayload: Sendable, Equatable, Decodable {
    public let url: URL
    public let certSHA256: String
    public let code: String

    enum CodingKeys: String, CodingKey {
        case url
        case certSHA256 = "cert_sha256"
        case code
    }

    public init(url: URL, certSHA256: String, code: String) {
        self.url = url
        self.certSHA256 = certSHA256
        self.code = code
    }

    public init(qrText: String) throws {
        guard let data = qrText.data(using: .utf8) else { throw PairingError.notAPairingCode }
        do {
            self = try JSONDecoder().decode(PairingPayload.self, from: data)
        } catch {
            throw PairingError.notAPairingCode
        }
    }

    /// The server this payload points at, with the trust it needs.
    public func server() throws -> ServerAddress {
        try ServerAddress(url: url, pin: CertificatePin(hex: certSHA256))
    }
}

/// A server's base URL and how to trust it. Only `https` is accepted.
public struct ServerAddress: Sendable, Hashable, Codable {
    public let baseURL: URL
    public let trust: ServerTrust

    public var host: String { baseURL.host() ?? "" }

    public init(url: URL, pin: CertificatePin?) throws {
        guard url.scheme?.lowercased() == "https",
              let host = url.host(), !host.isEmpty,
              url.user == nil, url.password == nil
        else { throw PairingError.notHTTPS }
        guard let trust = ServerTrust.required(forHost: host, pin: pin) else {
            throw PairingError.pinRequired
        }
        var parts = URLComponents()
        parts.scheme = "https"
        parts.host = host
        parts.port = url.port
        guard let base = parts.url else { throw PairingError.notHTTPS }
        baseURL = base
        self.trust = trust
    }

    /// Parses a URL typed by hand. A missing scheme means https.
    public init(typed text: String, pin: CertificatePin?) throws {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let withScheme = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
        guard let url = URL(string: withScheme) else { throw PairingError.notHTTPS }
        try self.init(url: url, pin: pin)
    }
}

public enum PairingError: Error, Equatable, LocalizedError {
    case notAPairingCode
    case notHTTPS
    case pinRequired

    public var errorDescription: String? {
        switch self {
        case .notAPairingCode:
            "This QR code is not a my-petkit pairing code."
        case .notHTTPS:
            "The server address must be an https URL."
        case .pinRequired:
            "A local server needs its certificate fingerprint. Scan the QR code from Server, Pair a phone."
        }
    }
}
