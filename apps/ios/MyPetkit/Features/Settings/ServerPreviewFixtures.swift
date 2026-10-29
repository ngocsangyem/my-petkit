import Foundation
import PetkitCore

#if DEBUG
/// A session for previews of the Server screens: shaped like a paired local
/// server, never contacted (previews pass loaded models, so nothing calls it).
@MainActor
enum ServerPreviewFixtures {
    static let session: ServerSession = {
        let pin = CertificatePin(hex: String(repeating: "3fa9c2", count: 10) + "e741")
        guard let url = URL(string: "https://192.168.1.20:8443"),
              let address = try? ServerAddress(url: url, pin: pin)
        else { fatalError("The preview server address is malformed.") }
        return ServerSession(paired: PairedServer(address: address, token: "preview", tokenID: 1))
    }()
}
#endif
