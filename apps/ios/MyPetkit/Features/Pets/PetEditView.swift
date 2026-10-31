import PetkitCore
import SwiftUI

/// Edit one cat: its name, registered weight and weight matching, its face
/// photos, which devices hold them, and removal. Everything but the photos
/// and removal is a draft saved by Done. Reads the pet from the model so a
/// saved change shows at once.
struct PetEditView: View {
    @Environment(ServerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    let model: PetsModel
    let petID: Int
    /// "Now" for the "updated" line; fixed in snapshots.
    var now = Date()

    @State private var draft: PetEditDraft?
    @State private var pickingTolerance = false
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
                EmptyBlock(title: L10n.string("This cat is gone"), message: L10n.string("It was removed or the list could not be read."))
                    .padding(.top, 80)
            }
        }
        .background(Theme.Color.ground.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .onAppear { if draft == nil, let pet { draft = PetEditDraft(pet: pet) } }
        .sheet(isPresented: $pickingTolerance) {
            if let draft {
                PetToleranceSheet(petName: pet?.name ?? "", current: draft.toleranceG) { self.draft?.toleranceG = $0 }
            }
        }
        .petFaceAdder(isChoosing: $choosingFace, petName: pet?.name ?? "") { jpeg in
            guard let pet else { return }
            try await session.call(purpose: L10n.string("Add a face photo")) { try await model.addFace(to: pet, jpeg: jpeg) }
        }
        .confirmationDialog("Delete this face photo?", isPresented: Binding(
            get: { faceToDelete != nil }, set: { if !$0 { faceToDelete = nil } }
        ), titleVisibility: .visible) {
            Button("Delete photo", role: .destructive) { deleteFace() }
        } message: {
            Text("The devices stop matching against it the next time they fetch.")
        }
        .alert(L10n.string("Remove \(pet?.name ?? L10n.string("this cat"))?"), isPresented: $confirmsRemove) {
            Button("Remove", role: .destructive) { remove() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Its face photos are deleted too. Past visits keep their records.")
        }
    }

    private func content(_ pet: PetRecord) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.gap) {
            HStack {
                IconButton(systemImage: "chevron.left", label: L10n.string("Back")) { dismiss() }
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
                    Text(PetRules.assignedLine(pet.deviceIDs.count))
                        .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                }
            }
            if let error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative).padding(.horizontal, 4)
            }
            PetProfileCard(draft: binding(pet), pet: pet, now: now) { save(pet) }
            PetRecognitionSection(draft: binding(pet)) { pickingTolerance = true }
            PetFacesCard(pet: pet, add: { choosingFace = true }, delete: { faceToDelete = $0 })
            PetDevicesSection(draft: binding(pet), pet: pet, pets: model.pets.value ?? [], devices: model.devices)
            Card(padding: 0) {
                Button { confirmsRemove = true } label: {
                    SettingsRow(title: L10n.string("Remove \(pet.name)"), isDestructive: true)
                        .padding(.horizontal, Theme.Space.pad)
                }
                .buttonStyle(.plain)
                .disabled(busy)
            }
        }
        .padding(.horizontal, Theme.Space.screenEdge)
        .padding(.bottom, Theme.Space.pad)
    }

    /// The draft as a binding; before `onAppear` fills it, the pet's own values.
    private func binding(_ pet: PetRecord) -> Binding<PetEditDraft> {
        Binding(get: { draft ?? PetEditDraft(pet: pet) }, set: { draft = $0 })
    }

    private func save(_ pet: PetRecord) {
        let current = draft ?? PetEditDraft(pet: pet)
        let change: PetUpdate
        do {
            change = try current.changes(from: pet)
        } catch {
            self.error = error.localizedDescription
            return
        }
        guard !change.isEmpty else {
            dismiss()
            return
        }
        let added = model.devices.filter { current.addedDeviceIDs(from: pet).contains($0.id) }
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                try await session.call(purpose: L10n.string("Save \(pet.name)")) { try await model.update(pet, change) }
                dismiss()
            } catch {
                self.error = PetWeightRules.saveErrorMessage(error, addedDevices: added)
            }
        }
    }

    private func deleteFace() {
        guard let pet, let face = faceToDelete else { return }
        Task {
            do {
                try await session.call(purpose: L10n.string("Delete a face photo")) { try await model.deleteFace(face, of: pet) }
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
                try await session.call(purpose: L10n.string("Remove \(pet.name)")) { try await model.delete(pet) }
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
