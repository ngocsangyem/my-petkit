import Foundation
import Observation
import PetkitAPI
import PetkitCore
import UIKit

/// Pairing this phone with a server, by QR code or by hand.
///
/// - QR: the code carries `{url, cert_sha256, code}`; trusting it redeems the
///   code for a client token.
/// - By hand: the server's certificate is read and shown so the user can
///   compare it with the fingerprint in the server log. Then the admin
///   password (or, on a server with no admin yet, the setup token and a new
///   password) opens a browser-style session that mints a pairing code for
///   this phone and redeems it, the same as scanning would.
@MainActor
@Observable
final class OnboardingModel {
    enum Step: Equatable {
        case scan
        case found(PairingPayload, ServerAddress)
        case manualAddress
        case confirmFingerprint(ServerAddress, CertificatePin)
        case signIn(ServerAddress)
        case firstRun(ServerAddress)
    }

    var step: Step = .scan
    var busy = false
    var error: String?
    var addressText = ""

    private let onPaired: (PairedServer) -> Void
    /// The unauthenticated client for the server being paired; its session
    /// holds the sign-in cookie in memory only, and is dropped after pairing.
    private var pending: (address: ServerAddress, client: Client)?

    init(onPaired: @escaping (PairedServer) -> Void) {
        self.onPaired = onPaired
    }

    static var clientName: String {
        String(UIDevice.current.name.prefix(64))
    }

    // MARK: QR

    func scanned(_ text: String) {
        guard case .scan = step else { return }
        do {
            let payload = try PairingPayload(qrText: text)
            step = .found(payload, try payload.server())
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    func trustScanned() {
        guard case .found(let payload, let address) = step else { return }
        run {
            try await self.redeem(code: payload.code, at: address, with: self.client(for: address))
        }
    }

    // MARK: By hand

    func submitAddress() {
        run {
            let url = try ServerAddress.url(typed: self.addressText)
            guard ServerTrust.isLocal(url.host() ?? "") else {
                self.step = try await self.detectAdmin(at: ServerAddress(url: url, pin: nil))
                return
            }
            // A local server is pinned, so its certificate is read first and
            // shown for comparison; nothing is sent until the user agrees.
            let address = try await ServerAddress(url: url, pin: CertificateProbe.pin(for: url))
            guard case .pinned(let pin) = address.trust else { return }
            self.step = .confirmFingerprint(address, pin)
        } describing: { error in
            (error as? PairingError)?.localizedDescription
                ?? "No MyPetKit server answered at that address."
        }
    }

    func trustFingerprint() {
        guard case .confirmFingerprint(let address, _) = step else { return }
        run { self.step = try await self.detectAdmin(at: address) }
    }

    func signIn(password: String) {
        guard case .signIn(let address) = step else { return }
        run {
            let client = self.client(for: address)
            _ = try await client.authLogin(body: .json(.init(password: password))).ok
            try await self.pairSignedIn(password: password, at: address, with: client)
        } describing: { error in
            APIError.from(error)?.status == 401 ? "That password is not right." : nil
        }
    }

    func createAdmin(setupToken: String, password: String) {
        guard case .firstRun(let address) = step else { return }
        run {
            let client = self.client(for: address)
            let token = setupToken.trimmingCharacters(in: .whitespacesAndNewlines)
            _ = try await client.authSetup(body: .json(.init(setupToken: token, password: password))).ok
            try await self.pairSignedIn(password: password, at: address, with: client)
        }
    }

    func back() {
        error = nil
        pending = nil
        switch step {
        case .found, .manualAddress: step = .scan
        default: step = .manualAddress
        }
    }

    // MARK: Steps

    /// Which sign-in a server needs. `setup` checks for an existing admin
    /// before it reads the token or counts a failure, so a one-character
    /// password answers the question without spending a try.
    private func detectAdmin(at address: ServerAddress) async throws -> Step {
        let client = self.client(for: address)
        do {
            _ = try await client.authSetup(body: .json(.init(setupToken: "-", password: "-"))).ok
            return .signIn(address)
        } catch {
            switch APIError.from(error)?.code {
            case "already_set_up": return .signIn(address)
            case "weak_password": return .firstRun(address)
            default: throw error
            }
        }
    }

    private func pairSignedIn(password: String, at address: ServerAddress, with client: Client) async throws {
        _ = try await client.authStepUp(body: .json(.init(password: password))).ok
        let code = try await client.authPairingCreate().ok.body.json.code
        try await redeem(code: code, at: address, with: client)
        _ = try? await client.authLogout()
    }

    private func redeem(code: String, at address: ServerAddress, with client: Client) async throws {
        let issued = try await client.authPairingRedeem(
            body: .json(.init(code: code, name: Self.clientName))
        ).ok.body.json
        pending = nil
        onPaired(PairedServer(address: address, token: issued.token, tokenID: issued.tokenId))
    }

    private func client(for address: ServerAddress) -> Client {
        if let pending, pending.address == address { return pending.client }
        let client = Client(address: address, session: address.trust.session(host: address.host),
                            signingIn: true, token: { nil })
        pending = (address, client)
        return client
    }

    private func run(
        _ work: @escaping @MainActor () async throws -> Void,
        describing describe: @escaping (any Error) -> String? = { _ in nil }
    ) {
        guard !busy else { return }
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                try await work()
            } catch {
                self.error = describe(error) ?? Loadable<Void>.message(for: error)
            }
        }
    }
}
