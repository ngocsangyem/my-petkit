import PetkitCore
import SwiftUI

/// "Automation" on a litter box detail (`ios-device-t6`): auto clean after a
/// visit and the clean delay when the box has them, then the auto-pack rows
/// when it supports auto-pack (the T6). A failed automation read shows its
/// error in the block; a box with none of these has no section. Entity
/// changes go through `askEntity` (the clean delay first through
/// `pickEntity`'s picker), turning auto-pack on through `confirm`.
struct LitterAutomationSection: View {
    @Environment(ServerSession.self) private var session
    let model: DeviceDetailModel
    let device: DeviceRecord
    let now: Date
    let askEntity: (DeviceEntity, EntityWrite) -> Void
    let confirm: (CommandConfirmation) -> Void
    /// Opens the picker for a number row drawn as value and chevron.
    var pickEntity: ((DeviceEntity) -> Void)?

    private var entities: [DeviceEntity] { EntityGroups(device).automationControls }
    private var isLitter: Bool { DeviceFamily(deviceType: device.type) == .litter }

    private var autoPack: (rule: AutoPackRule, status: AutoPackStatus?)? {
        guard let info = model.automation.value?.autoPack, info.supported, let rule = info.rule else { return nil }
        return (rule, info.status)
    }

    private var failure: String? {
        if isLitter, case .failed(let message) = model.automation { return message }
        return nil
    }

    var body: some View {
        if !entities.isEmpty || autoPack != nil || failure != nil {
            SectionHeader("Automation").accessibilityAddTraits(.isHeader)
            RowsCard {
                if !entities.isEmpty {
                    EntityRows(entities: entities, enabled: device.online, labels: EntityGroups.automationLabels,
                               pick: pickEntity, ask: askEntity)
                }
                if let autoPack {
                    if !entities.isEmpty { RowRule() }
                    AutoPackRows(rule: autoPack.rule, status: autoPack.status,
                                 zone: DeviceFacts.zone(device.timezoneInfo), now: now,
                                 busy: model.autoPackBusy, error: model.autoPackError,
                                 save: { rule in Task { await model.saveAutoPack(rule, session: session) } },
                                 askEnable: { confirm(enableConfirmation($0)) })
                }
                if let failure {
                    if !entities.isEmpty { RowRule() }
                    BlockError(message: failure) { Task { await model.loadAutomation(session) } }
                        .padding(.vertical, 12)
                }
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

#Preview("Automation") {
    ScrollView {
        VStack(alignment: .leading, spacing: Theme.Space.gap) {
            LitterAutomationSection(
                model: DeviceDetailModel(device: DevicePreviewFixtures.litterBox, sessions: [],
                                         automation: DevicePreviewFixtures.autoPackOn),
                device: DevicePreviewFixtures.litterBox, now: DevicePreviewFixtures.now,
                askEntity: { _, _ in }, confirm: { _ in })
        }
        .padding()
    }
    .background(Theme.Color.ground)
    .environment(ServerSession.preview)
}
