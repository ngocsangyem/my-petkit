import Foundation
import PetkitAPI
import PetkitCore

/// A litter box's force continue and auto-pack. The read is asked of litter
/// boxes only (any other device answers "supports neither"); every write
/// reloads it, so the screen shows what the server holds.
extension DeviceDetailModel {
    func loadAutomation(_ session: ServerSession) async {
        guard let device = device.value, DeviceFamily(deviceType: device.type) == .litter else {
            automation = .loaded(.unsupported)
            return
        }
        do { automation = .loaded(try await DevicesAPI(session: session).litterAutomation(deviceID)) } catch {
            automation = .failed("Could not load automation. \(Loadable<Void>.message(for: error))")
        }
    }

    /// Asks for the password, then reads the guards again so the sheet ticks
    /// what is true now. False when the password was not confirmed.
    func prepareForceContinue(session: ServerSession) async -> Bool {
        guard await session.requestStepUp(purpose: ForceContinueRules.stepUpPurpose) else { return false }
        await loadAutomation(session)
        return true
    }

    /// The one continue (R3), sent from the sheet. Not wrapped in
    /// `session.call`: the password screen cannot open over a sheet, so an
    /// expired step-up is thrown for the sheet to explain.
    func forceContinue(session: ServerSession) async throws {
        let said = try await DevicesAPI(session: session).forceContinue(deviceID)
        lastCommand = "Last: Continue cleaning · \(said)"
        await loadDevice(session)
        await loadAutomation(session)
    }

    /// Replaces the auto-pack rule (R1); a refusal shows under the block.
    func saveAutoPack(_ rule: AutoPackRule, session: ServerSession) async {
        do { try await enableAutoPack(rule, session: session) } catch {
            autoPackError = Loadable<Void>.message(for: error)
        }
    }

    /// Replaces the auto-pack rule and keeps the server's answer, throwing
    /// the refusal so the confirm sheet that turns it on can keep it on screen.
    func enableAutoPack(_ rule: AutoPackRule, session: ServerSession) async throws {
        autoPackBusy = true
        autoPackError = nil
        defer { autoPackBusy = false }
        let id = deviceID
        let result = try await session.call(purpose: "Change auto-pack") {
            try await DevicesAPI(session: session).setAutoPack(id, rule: rule)
        }
        if var current = automation.value {
            current.autoPack.rule = result.rule
            current.autoPack.status = result.status
            automation = .loaded(current)
        }
    }
}
