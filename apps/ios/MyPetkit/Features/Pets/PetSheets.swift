import PetkitCore
import SwiftUI

/// Add a cat: its name and the recognising devices that should get its photos.
struct PetAddSheet: View {
    @Environment(ServerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    let model: PetsModel

    @State private var name = ""
    @State private var deviceIDs: Set<Int> = []
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Add a cat").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            LabeledField(label: L10n.string("Name")) {
                TextField("Name", text: $name).textInputAutocapitalization(.words).submitLabel(.done)
            }
            if !model.aiDevices.isEmpty {
                Text("Send its face photos to").font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                    .padding(.leading, 4)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(model.aiDevices) { device in
                            Chip(title: device.name.isEmpty ? L10n.string("Device \(device.id)") : device.name,
                                 isSelected: deviceIDs.contains(device.id)) {
                                if deviceIDs.contains(device.id) {
                                    deviceIDs.remove(device.id)
                                } else {
                                    deviceIDs.insert(device.id)
                                }
                            }
                        }
                    }
                }
            }
            if let error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
            }
            Button { save() } label: {
                if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Add cat") }
            }
            .buttonStyle(.primary)
            .disabled(busy || PetRules.validName(name) == nil)
            Button("Cancel") { dismiss() }
                .font(Theme.Font.button).foregroundStyle(Theme.Color.text)
                .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
        .onAppear { deviceIDs = Set(model.aiDevices.map(\.id)) }
    }

    private func save() {
        guard let valid = PetRules.validName(name) else { return }
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                let ids = deviceIDs.sorted()
                try await session.call(purpose: L10n.string("Add \(valid)")) { try await model.create(name: valid, deviceIDs: ids) }
                dismiss()
            } catch {
                self.error = Loadable<Void>.message(for: error)
            }
        }
    }
}

/// Import the pets and reference photos PetKit holds for one device. This is
/// the one place the app makes the server talk to the PetKit cloud, so the
/// sheet says so before the button.
struct PetImportSheet: View {
    @Environment(ServerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    let model: PetsModel

    @State private var deviceID: Int?
    @State private var busy = false
    @State private var error: String?
    @State private var summary: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Import from PetKit").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            WarningPanel(text: cloudWarning)
            if model.aiDevices.isEmpty {
                Text("No device here does face recognition, so PetKit holds no pets for it.")
                    .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(model.aiDevices) { device in
                            Chip(title: device.name.isEmpty ? L10n.string("Device \(device.id)") : device.name,
                                 isSelected: deviceID == device.id) { deviceID = device.id }
                        }
                    }
                }
            }
            if let summary {
                Text(summary).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
            }
            if let error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
            }
            Button { run() } label: {
                if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Import pets") }
            }
            .buttonStyle(.primary)
            .disabled(busy || deviceID == nil)
            Button(summary == nil ? L10n.string("Cancel") : L10n.string("Done")) { dismiss() }
                .font(Theme.Font.button).foregroundStyle(Theme.Color.text)
                .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
        .onAppear { deviceID = deviceID ?? model.aiDevices.first?.id }
    }

    private var cloudWarning: String {
        L10n.string("This contacts the PetKit cloud once, signing as the device, to fetch the pets and face photos PetKit holds for it.")
            + " " + L10n.string("Nothing is sent on a schedule.")
    }

    private func run() {
        guard let deviceID else { return }
        busy = true
        error = nil
        summary = nil
        Task {
            defer { busy = false }
            do {
                summary = try await session.call(purpose: L10n.string("Import pets from PetKit")) {
                    try await model.importPets(deviceID: deviceID)
                }
            } catch {
                self.error = Loadable<Void>.message(for: error)
            }
        }
    }
}

#Preview("Add") {
    PetsPreview.wrap { Color.clear.sheet(isPresented: .constant(true)) { PetAddSheet(model: .fixture()) } }
}

#Preview("Import") {
    PetsPreview.wrap { Color.clear.sheet(isPresented: .constant(true)) { PetImportSheet(model: .fixture()) } }
}
