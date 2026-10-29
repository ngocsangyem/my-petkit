import PetkitCore
import SwiftUI

/// Edit one cat: its name, its face photos and which devices hold them, and
/// removal. Reads the pet from the model so a saved change shows at once.
struct PetEditView: View {
    @Environment(ServerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    let model: PetsModel
    let petID: Int

    @State private var name = ""
    @State private var busy = false
    @State private var error: String?
    @State private var choosingFace = false
    @State private var confirmsRemove = false
    @State private var faceToDelete: PetFaceRef?

    private var pet: PetRecord? { model.pets.value?.first { $0.id == petID } }

    var body: some View {
        ScrollView {
            if let pet {
                content(pet)
            } else {
                EmptyBlock(title: "This cat is gone", message: "It was removed or the list could not be read.")
                    .padding(.top, 80)
            }
        }
        .background(Theme.Color.ground.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .onAppear { name = pet?.name ?? "" }
        .petFaceAdder(isChoosing: $choosingFace, petName: pet?.name ?? "") { jpeg in
            guard let pet else { return }
            try await session.call(purpose: "Add a face photo") { try await model.addFace(to: pet, jpeg: jpeg) }
        }
        .confirmationDialog("Delete this face photo?", isPresented: Binding(
            get: { faceToDelete != nil }, set: { if !$0 { faceToDelete = nil } }
        ), titleVisibility: .visible) {
            Button("Delete photo", role: .destructive) { deleteFace() }
        } message: {
            Text("The devices stop matching against it the next time they fetch.")
        }
        .alert("Remove \(pet?.name ?? "this cat")?", isPresented: $confirmsRemove) {
            Button("Remove", role: .destructive) { remove() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Its face photos are deleted too. Past visits keep their records.")
        }
    }

    private func content(_ pet: PetRecord) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.gap) {
            HStack {
                IconButton(systemImage: "chevron.left", label: "Back") { dismiss() }
                Spacer()
                Button("Done") { save(pet) }
                    .font(Theme.Font.button)
                    .foregroundStyle(Theme.Color.accent)
                    .disabled(busy)
            }
            HStack(spacing: 14) {
                PetPhoto(name: pet.name, photoPath: pet.photoPath, tintIndex: model.tintIndex(of: pet))
                    .frame(width: 64, height: 64)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(pet.name).font(Theme.Font.title).accessibilityAddTraits(.isHeader)
                    Text(pet.deviceIDs.isEmpty ? "No device assigned" : "on " + PetRules.plural(pet.deviceIDs.count, "device"))
                        .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                }
            }
            Card {
                LabeledField(label: "Name") {
                    TextField("Name", text: $name).textInputAutocapitalization(.words).submitLabel(.done)
                        .onSubmit { save(pet) }
                }
                if let error {
                    Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
                }
            }
            PetFacesCard(pet: pet, add: { choosingFace = true }, delete: { faceToDelete = $0 })
            devices(pet)
            Card(padding: 0) {
                Button { confirmsRemove = true } label: {
                    SettingsRow(title: "Remove \(pet.name)", isDestructive: true)
                        .padding(.horizontal, Theme.Space.pad)
                }
                .buttonStyle(.plain)
                .disabled(busy)
            }
        }
        .padding(.horizontal, Theme.Space.screenEdge)
        .padding(.bottom, Theme.Space.pad)
    }

    @ViewBuilder
    private func devices(_ pet: PetRecord) -> some View {
        let assigned = model.devices.filter { pet.deviceIDs.contains($0.id) }
        if !assigned.isEmpty {
            SectionHeader("Devices")
            Card {
                ForEach(Array(assigned.enumerated()), id: \.element.id) { index, device in
                    if index > 0 { RowRule() }
                    HStack(spacing: 12) {
                        DeviceDrawing(kind: DeviceKind(deviceType: device.deviceType), height: 36)
                            .frame(width: 44)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(device.name.isEmpty ? "Device \(device.id)" : device.name).font(Theme.Font.body)
                            Text(PetRules.deviceFaceLine(device: device, faceIDs: pet.faces.map(\.id)))
                                .font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
                        }
                        Spacer(minLength: 0)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            Text("A box loads the photos the next time it asks the server; until then it matches against what it holds.")
                .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted).padding(.horizontal, 4)
        }
    }

    private func save(_ pet: PetRecord) {
        guard let valid = PetRules.validName(name) else {
            error = "A cat needs a name."
            return
        }
        guard valid != pet.name else {
            dismiss()
            return
        }
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                try await session.call(purpose: "Rename \(pet.name)") { try await model.rename(pet, to: valid) }
                dismiss()
            } catch {
                self.error = Loadable<Void>.message(for: error)
            }
        }
    }

    private func deleteFace() {
        guard let pet, let face = faceToDelete else { return }
        Task {
            do {
                try await session.call(purpose: "Delete a face photo") { try await model.deleteFace(face, of: pet) }
            } catch {
                self.error = Loadable<Void>.message(for: error)
            }
        }
    }

    private func remove() {
        guard let pet else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                try await session.call(purpose: "Remove \(pet.name)") { try await model.delete(pet) }
                dismiss()
            } catch {
                self.error = Loadable<Void>.message(for: error)
            }
        }
    }
}

#Preview {
    PetsPreview.wrap {
        NavigationStack { PetEditView(model: .fixture(), petID: 1) }
    }
}
