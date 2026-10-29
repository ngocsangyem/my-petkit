import Foundation
import Testing
@testable import PetkitCore

struct ServerTrustTests {
    private let pin = CertificatePin(hex: String(repeating: "0f", count: 32))!

    @Test(arguments: ["192.168.1.20", "10.0.0.5", "fd00::1", "[fd00::1]", "homeassistant",
                      "homeassistant.local", "Pi.LOCAL"])
    func localHostsArePinned(_ host: String) {
        #expect(ServerTrust.isLocal(host))
        #expect(ServerTrust.required(forHost: host, pin: pin) == .pinned(pin))
        #expect(ServerTrust.required(forHost: host, pin: nil) == nil)
    }

    @Test(arguments: ["pi.tail1234.ts.net", "petkit.example.com", "spike.localtest.me"])
    func publicNamesUseSystemTrust(_ host: String) {
        #expect(!ServerTrust.isLocal(host))
        #expect(ServerTrust.required(forHost: host, pin: pin) == .system)
        #expect(ServerTrust.required(forHost: host, pin: nil) == .system)
    }

    @Test func pairingPayloadDecodesTheServerQRShape() throws {
        let text = #"{"url": "https://192.168.1.20:8443", "cert_sha256": "\#(pin.hex)", "code": "abc"}"#
        let payload = try PairingPayload(qrText: text)
        let server = try payload.server()
        #expect(payload.code == "abc")
        #expect(server.baseURL.absoluteString == "https://192.168.1.20:8443")
        #expect(server.trust == .pinned(pin))
    }

    @Test func rejectsPlainHTTPAndCredentialsInTheURL() {
        #expect(throws: PairingError.notHTTPS) { try ServerAddress(typed: "http://192.168.1.20:8443", pin: pin) }
        #expect(throws: PairingError.notHTTPS) { try ServerAddress(typed: "https://u:p@pi.local:8443", pin: pin) }
        #expect(throws: PairingError.notAPairingCode) { try PairingPayload(qrText: "hello") }
    }

    @Test func typedAddressDefaultsToHTTPSAndDropsThePath() throws {
        let server = try ServerAddress(typed: " pi.example.com:8443/app/ ", pin: nil)
        #expect(server.baseURL.absoluteString == "https://pi.example.com:8443")
        #expect(server.trust == .system)
    }

    @Test func pairedServerRoundTripsThroughJSON() throws {
        let address = try ServerAddress(typed: "192.168.1.20:8443", pin: pin)
        let paired = PairedServer(address: address, token: "t", tokenID: 3, pairedAt: Date(timeIntervalSince1970: 0))
        let decoded = try JSONDecoder().decode(PairedServer.self, from: JSONEncoder().encode(paired))
        #expect(decoded == paired)
    }
}
