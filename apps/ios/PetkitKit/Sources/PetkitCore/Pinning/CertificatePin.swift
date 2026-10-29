import CryptoKit
import Foundation
import Security

/// The SHA-256 of the server's leaf certificate (DER), as carried by the
/// pairing QR code. The user plane uses one self-signed certificate per
/// install, so trust is "this exact certificate", never a CA chain.
public struct CertificatePin: Sendable, Hashable {
    public let sha256: Data

    /// Parses 64 hex digits, upper or lower case, with or without `:` separators.
    public init?(hex: String) {
        let digits = hex.filter { $0 != ":" }
        guard digits.count == 64 else { return nil }
        var bytes = Data(capacity: 32)
        var index = digits.startIndex
        while index < digits.endIndex {
            let next = digits.index(index, offsetBy: 2)
            guard let byte = UInt8(digits[index..<next], radix: 16) else { return nil }
            bytes.append(byte)
            index = next
        }
        sha256 = bytes
    }

    public init(certificateDER: Data) {
        sha256 = Data(SHA256.hash(data: certificateDER))
    }

    /// Lower-case hex, the same form the server prints.
    public var hex: String {
        sha256.map { String(format: "%02x", $0) }.joined()
    }

    /// The first and last four hex digits, for display and logs: enough to
    /// compare by eye, never the whole fingerprint.
    public var shortHex: String {
        let full = hex
        return "\(full.prefix(8))…\(full.suffix(8))"
    }

    /// True when the leaf certificate presented in `trust` is the pinned one.
    /// Chain building and expiry are deliberately not evaluated: the
    /// certificate is self-signed and the pin is the whole trust decision.
    public func matches(_ trust: SecTrust) -> Bool {
        guard let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate],
              let leaf = chain.first
        else { return false }
        return CertificatePin(certificateDER: SecCertificateCopyData(leaf) as Data) == self
    }
}
