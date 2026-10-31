import Foundation
import Observation
import PetkitAPI
import PetkitCore

/// Which server this phone is paired with, if any. The pairing (address,
/// trust and token) lives in the Keychain only.
@MainActor
@Observable
final class AppModel {
    enum Phase {
        case loading
        case unpaired
        case paired(ServerSession)
    }

    private(set) var phase: Phase = .loading
    private(set) var storageError: String?
    @ObservationIgnored private let store: PairedServerStore

    init(store: PairedServerStore = PairedServerStore()) {
        self.store = store
    }

    func start() {
        guard case .loading = phase else { return }
        do {
            phase = try store.load().map { .paired(ServerSession(paired: $0)) } ?? .unpaired
        } catch {
            storageError = L10n.string("The saved pairing could not be read. Pair this phone again.")
            phase = .unpaired
        }
    }

    func didPair(_ server: PairedServer) {
        do {
            try store.save(server)
            storageError = nil
        } catch {
            storageError = L10n.string("The pairing could not be saved to the Keychain; it lasts until the app quits.")
        }
        phase = .paired(ServerSession(paired: server))
    }

    /// Revokes this phone's token on the server when it still answers, then
    /// forgets the pairing locally either way.
    func signOut() async {
        if case .paired(let session) = phase {
            let id = session.paired.tokenID
            _ = try? await session.call(purpose: L10n.string("Signing out revokes this phone's token on the server.")) {
                try await session.client.authRevokeToken(path: .init(id: id)).ok
            }
        }
        forget()
    }

    func forget() {
        try? store.forget()
        phase = .unpaired
    }
}
