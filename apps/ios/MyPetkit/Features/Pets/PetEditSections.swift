import PetkitCore
import SwiftUI

/// Name and registered weight, with how the weight is kept up to date.
struct PetProfileCard: View {
    @Binding var draft: PetEditDraft
    let pet: PetRecord
    var now = Date()
    let submit: () -> Void
    @Environment(\.timeZone) private var zone

    var body: some View {
        Card {
            LabeledField(label: "Name") {
                TextField("Name", text: $draft.name).textInputAutocapitalization(.words).submitLabel(.done)
                    .onSubmit(submit)
            }
            LabeledField(label: "Registered weight") {
                HStack(spacing: 4) {
                    TextField("0.00", text: $draft.weightText)
                        .keyboardType(.decimalPad)
                        .font(Theme.Font.bodyMedium.weight(.semibold))
                        .monospacedDigit()
                        .fixedSize()
                        .accessibilityLabel("Registered weight in kilograms")
                    Text("kg").font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                    Spacer(minLength: 8)
                    if let updated = PetWeightRules.updatedLine(pet.weightUpdatedAt, now: now, zone: zone) {
                        Text(updated).font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
                    }
                }
            }
            Text("Visits the camera recognised, or that you assigned, keep this up to date. "
                + "Visits matched only by weight never change it.")
                .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Matching by weight and its tolerance, both per pet.
struct PetRecognitionSection: View {
    @Binding var draft: PetEditDraft
    let pickTolerance: () -> Void

    var body: some View {
        SectionHeader("Recognition")
        RowsCard {
            SettingToggleRow(title: "Match by weight when the camera cannot",
                             footnote: PetWeightRules.matchSentence(toleranceG: draft.toleranceG),
                             isOn: $draft.matchesByWeight)
                // Held at its ideal height: the title wraps to two lines, and a
                // tight height proposal would push the footnote onto the rule.
                .padding(.vertical, 10)
                .fixedSize(horizontal: false, vertical: true)
            RowRule()
            Button(action: pickTolerance) {
                SettingsRow(title: "Weight tolerance", value: PetWeightRules.toleranceText(draft.toleranceG))
                    .monospacedDigit()
            }
            .buttonStyle(.plain)
            .accessibilityHint("Choose how far a visit may sit from the registered weight")
        }
    }
}

/// Which devices get the pet's face photos, against the 15-cat limit.
struct PetDevicesSection: View {
    @Binding var draft: PetEditDraft
    let pet: PetRecord
    let pets: [PetRecord]
    let devices: [PetDevice]

    private var recognising: [PetDevice] { devices.filter(\.supportsAI) }

    var body: some View {
        if !devices.isEmpty {
            SectionHeader(title: "Devices") {
                if recognising.count == 1, let box = recognising.first {
                    Text(PetWeightRules.capacityLine(count(on: box)))
                        .font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
                }
            }
            RowsCard {
                ForEach(Array(devices.enumerated()), id: \.element.id) { index, device in
                    if index > 0 { RowRule() }
                    row(device)
                }
            }
            Text("A box recognises up to \(PetWeightRules.maxPetsPerDevice) cats. "
                + "Turning a box off here stops sending \(pet.name)'s photos to it.")
                .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 4)
        }
    }

    private func count(on device: PetDevice) -> Int {
        PetWeightRules.catsOnDevice(device.id, pets: pets, editing: pet.id, isOn: draft.deviceIDs.contains(device.id))
    }

    private func line(_ device: PetDevice) -> String {
        let faces = PetRules.deviceFaceLine(device: device, faceIDs: pet.faces.map(\.id))
        guard device.supportsAI, recognising.count > 1 else { return faces }
        return faces + " · " + PetWeightRules.capacityLine(count(on: device), onThisBox: false)
    }

    private func row(_ device: PetDevice) -> some View {
        let isOn = Binding(
            get: { draft.deviceIDs.contains(device.id) },
            set: { on in
                if on { draft.deviceIDs.insert(device.id) } else { draft.deviceIDs.remove(device.id) }
            }
        )
        return Toggle(isOn: isOn) {
            HStack(spacing: 12) {
                DeviceDrawing(kind: DeviceKind(deviceType: device.deviceType), height: 36)
                    .frame(width: 44)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(device.name.isEmpty ? "Device \(device.id)" : device.name).font(Theme.Font.body)
                        .foregroundStyle(Theme.Color.text)
                    Text(line(device)).font(Theme.Font.extraSmall).monospacedDigit()
                        .foregroundStyle(Theme.Color.muted)
                }
            }
        }
        .tint(Theme.Color.text)
        // A model without recognition has nothing to load; it can only be
        // turned off if an older pet record put it on.
        .disabled(!device.supportsAI && !isOn.wrappedValue)
        .frame(minHeight: Theme.Space.rowHeight)
        .padding(.vertical, 4)
    }
}
