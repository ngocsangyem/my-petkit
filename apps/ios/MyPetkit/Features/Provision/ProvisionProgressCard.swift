import PetkitBLE
import PetkitCore
import SwiftUI

/// The top card of `ios-provision`: device, Bluetooth and phone drawn on one
/// panel, the status sentence, a bar at the true ratio of stages done and the
/// four stages as rows with check discs. No step badges.
struct ProvisionProgressCard: View {
    let deviceName: String?
    let status: String
    let done: Int
    let isRunning: Bool
    var failed = false

    var body: some View {
        Card {
            illustration
            VStack(alignment: .leading, spacing: 2) {
                Text(status.isEmpty ? L10n.string("Put the device in pairing mode, then choose it below.") : status)
                    .font(Theme.Font.bodyMedium)
                    .foregroundStyle(failed ? Theme.Color.negative : Theme.Color.text)
                    .fixedSize(horizontal: false, vertical: true)
                if let deviceName {
                    Text("New device \(deviceName)").font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                }
            }
            RatioBar(ratio: Double(done) / Double(ProvisionStage.allCases.count), label: "")
                .accessibilityLabel("\(done) of \(ProvisionStage.allCases.count) steps done")
            VStack(alignment: .leading, spacing: 12) {
                ForEach(ProvisionStage.allCases) { stage in
                    StageRow(title: stage.title, state: state(of: stage))
                }
            }
        }
    }

    private func state(of stage: ProvisionStage) -> StageRow.State {
        if stage.rawValue < done { return .done }
        return stage.rawValue == done && isRunning ? .active : .waiting
    }

    private var kind: DeviceKind {
        guard let deviceName else { return .litterBox }
        let parts = deviceName.split(separator: "_")
        return parts.count > 1 ? DeviceKind(deviceType: String(parts[1])) : .unknown
    }

    private var illustration: some View {
        HStack(spacing: 18) {
            DeviceDrawing(kind: kind, height: 96)
            HStack(spacing: 6) {
                Image(systemName: "dot.radiowaves.left.and.right").font(Theme.Font.icon)
                Text("•••").font(Theme.Font.bodyMedium)
            }
            .foregroundStyle(Theme.Color.accent)
            RoundedRectangle(cornerRadius: 12)
                .stroke(Theme.Color.text, lineWidth: 2.5)
                .frame(width: 60, height: 96)
                .overlay { DrumMark(size: 20) }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
        .accessibilityHidden(true)
    }
}

/// One stage: a check disc when done, a spinner while active, an empty ring while waiting.
struct StageRow: View {
    enum State { case done, active, waiting }

    let title: String
    let state: State

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                switch state {
                case .done:
                    Circle().fill(Theme.Color.pillPositive.0)
                    Image(systemName: "checkmark").font(Theme.Font.chevron).foregroundStyle(Theme.Color.pillPositive.1)
                case .active:
                    ProgressView().tint(Theme.Color.accent)
                case .waiting:
                    Circle().stroke(Theme.Color.stroke, lineWidth: 1.5)
                }
            }
            .frame(width: 22, height: 22)
            Text(title)
                .font(state == .active ? Theme.Font.bodyMedium.weight(.semibold) : Theme.Font.body)
                .foregroundStyle(state == .waiting ? Theme.Color.muted : Theme.Color.text)
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(state == .done ? L10n.string("Done") : state == .active ? L10n.string("In progress") : L10n.string("Waiting"))
    }
}

#Preview {
    ProvisionProgressCard(deviceName: "PETKIT_T6_8F2A", status: "Joining Wi-Fi… Keep the phone near the device.",
                          done: 2, isRunning: true)
        .padding()
        .background(Theme.Color.ground)
}
