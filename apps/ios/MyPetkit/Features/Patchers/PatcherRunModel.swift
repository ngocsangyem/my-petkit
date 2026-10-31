import Foundation
import Observation
import PetkitAPI
import PetkitCore

/// Starting one patcher run (R3) and following it. The POST only means
/// "accepted"; what the run did arrives as `patcher` live events, routed by
/// device id and the `[patcher_id]` prefix of each line.
@MainActor
@Observable
final class PatcherRunModel {
    let session: ServerSession
    let deviceID: Int
    let patcherID: String
    var pubkey: String
    /// Set when the user chose the other action than the obvious one.
    var actionOverride: PatcherAction?
    var busy = false
    var accepted = false
    /// The server's reason the run was refused (for example that it cannot
    /// reach the device), shown as it was sent.
    var error: String?

    init(session: ServerSession, deviceID: Int, patcherID: String, storedPubkey: String?) {
        self.session = session
        self.deviceID = deviceID
        self.patcherID = patcherID
        pubkey = storedPubkey ?? ""
    }

    /// Progress lines for this device and patcher still in the live buffer.
    var lines: [LiveEvent] {
        let device = String(deviceID)
        return session.recentEvents.filter {
            $0.kind == "patcher" && $0.deviceID == device && PatcherRules.patcherID(fromSummary: $0.summary) == patcherID
        }
    }

    func start(_ action: PatcherAction, needsKey: Bool, deviceName: String, patcherName: String) async {
        guard let patcher = Operations.ApplyDevicePatcher.Input.Body.JsonPayload.PatcherPayload(rawValue: patcherID) else {
            error = L10n.string("This app does not know the \(patcherID) patch.")
            return
        }
        let key = pubkey.trimmingCharacters(in: .whitespacesAndNewlines)
        if action == .apply, needsKey, !PatcherRules.isValidPublicKey(key) {
            error = L10n.string("Paste an SSH public key that starts with ssh-ed25519, ssh-rsa or ecdsa-sha2.")
            return
        }
        busy = true
        error = nil
        accepted = false
        defer { busy = false }
        let body = Operations.ApplyDevicePatcher.Input.Body.JsonPayload(
            patcher: patcher, action: action.rawValue,
            pubkey: action == .apply && needsKey ? key : nil)
        let purpose = action == .apply
            ? L10n.string("Applying \(patcherName) runs commands as root on \(deviceName) and reboots it.")
            : L10n.string("Removing \(patcherName) deletes its files from \(deviceName) and reboots it.")
        do {
            _ = try await session.call(purpose: purpose) {
                try await self.session.client.applyDevicePatcher(path: .init(id: self.deviceID), body: .json(body)).ok
            }
            accepted = true
        } catch {
            self.error = Loadable<Void>.message(for: error)
        }
    }
}
