import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import UIKit

/// The text another phone scans to pair: the `qr` object from
/// `authPairingCreate`, re-encoded as the JSON `PairingPayload(qrText:)`
/// reads. It is built on this phone so the one-time code never leaves it
/// except as the picture on screen.
enum PairingQRCode {
    private struct Payload: Encodable {
        let url: String
        let certSHA256: String
        let code: String

        enum CodingKeys: String, CodingKey {
            case url
            case certSHA256 = "cert_sha256"
            case code
        }
    }

    /// Compact JSON with stable key order and unescaped slashes, so the
    /// code stays as small (and as easy to scan) as it can be.
    static func text(url: String, certSHA256: String, code: String) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let data = try encoder.encode(Payload(url: url, certSHA256: certSHA256, code: code))
        return String(bytes: data, encoding: .utf8) ?? ""
    }

    /// A crisp QR image of `text`, scaled up by whole pixels so the modules
    /// stay square. Black on white whatever the appearance: scanners need it.
    static func image(for text: String, scale: CGFloat = 10) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?
            .transformed(by: CGAffineTransform(scaleX: scale, y: scale)),
            let cgImage = CIContext().createCGImage(output, from: output.extent)
        else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
