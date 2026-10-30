import PetkitCore
import SwiftUI

/// "Automation" on a litter box detail: the auto-pack block when the box
/// supports it (the T6), the block's error when the read failed, nothing for
/// a box without auto-pack. Turning auto-pack on goes through `confirm`.
struct LitterAutomationSection: View {
    @Environment(ServerSession.self) private var session
    let model: DeviceDetailModel
    let device: DeviceRecord
    let now: Date
    let confirm: (CommandConfirmation) -> Void

    var body: some View {
        switch model.automation {
        case .loading:
            EmptyView()
        case .failed(let message):
            if DeviceFamily(deviceType: device.type) == .litter {
                SectionHeader("Automation")
                Card { BlockError(message: message) { Task { await model.loadAutomation(session) } } }
            }
        case .loaded(let automation):
            if automation.autoPack.supported, let rule = automation.autoPack.rule {
                AutoPackCard(rule: rule, status: automation.autoPack.status,
                             zone: DeviceFacts.zone(device.timezoneInfo), now: now,
                             busy: model.autoPackBusy, error: model.autoPackError,
                             save: { rule in Task { await model.saveAutoPack(rule, session: session) } },
                             askEnable: { confirm(enableConfirmation($0)) })
            }
        }
    }

    private func enableConfirmation(_ rule: AutoPackRule) -> CommandConfirmation {
        CommandConfirmation(question: AutoPackText.confirmQuestion,
                            detail: "\(AutoPackText.summary(rule)) \(AutoPackText.confirmDetail)",
                            confirmTitle: "Turn on auto-pack") { [model, session] in
            try await model.enableAutoPack(rule, session: session)
        }
    }
}
