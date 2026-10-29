import PetkitCore
import SwiftUI

/// The Pets tab: a cat switcher, the selected cat's photo, the figures the
/// API has for it, its face photos, identities waiting to be bound, and the
/// import from the PetKit cloud.
struct PetsView: View {
    @State private var model: PetsModel

    init() {
        _model = State(initialValue: PetsModel())
    }

    init(model: PetsModel) {
        _model = State(initialValue: model)
    }

    var body: some View {
        PetsScreen(model: model)
    }
}

private struct PetsScreen: View {
    @Environment(ServerSession.self) private var session
    let model: PetsModel

    @State private var showsAdd = false
    @State private var showsImport = false
    @State private var choosingFace = false
    @State private var faceToDelete: PetFaceRef?
    @State private var refToBind: UnboundPetRef?
    @State private var actionError: String?

    var body: some View {
        ScreenScroll {
            ScreenHeader(title: "Pets") {
                IconButton(systemImage: "plus", label: "Add a cat") { showsAdd = true }
            }
        } content: {
            LoadableBlock(state: model.pets, loadingHeight: 230, retry: retryPets) { pets in
                if pets.isEmpty {
                    Card {
                        EmptyBlock(title: "No cats yet",
                                   message: "Add a cat, or import the ones PetKit already recognises.",
                                   actionTitle: "Add a cat") { showsAdd = true }
                            .padding(.vertical, 24)
                    }
                } else if let pet = model.selected {
                    switcher(pets)
                    PetHeroCard(pet: pet, tintIndex: model.tintIndex(of: pet),
                                line: PetRules.recognitionLine(pet: pet, devices: model.devices))
                    PetWeightCard(pet: pet, week: model.visits[pet.id]?.value)
                    PetVisitsCard(state: model.visits[pet.id]) { Task { await model.loadVisits(force: true) } }
                    PetFacesCard(pet: pet, add: { choosingFace = true }, delete: { faceToDelete = $0 })
                }
            }
            actions
        }
        .refreshable { await model.load() }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            model.attach(session)
            await model.load()
        }
        .sheet(isPresented: $showsAdd) { PetAddSheet(model: model) }
        .sheet(isPresented: $showsImport) { PetImportSheet(model: model) }
        .petFaceAdder(isChoosing: $choosingFace, petName: model.selected?.name ?? "") { jpeg in
            guard let pet = model.selected else { return }
            try await session.call(purpose: "Add a face photo") { try await model.addFace(to: pet, jpeg: jpeg) }
        }
        .confirmationDialog("Delete this face photo?", isPresented: isPresent($faceToDelete),
                            titleVisibility: .visible) {
            Button("Delete photo", role: .destructive) { deleteFace() }
        } message: {
            Text("The devices stop matching against it the next time they fetch.")
        }
        .confirmationDialog(bindQuestion, isPresented: isPresent($refToBind), titleVisibility: .visible) {
            Button("Bind to \(model.selected?.name ?? "this cat")") { bind() }
        } message: {
            Text("Past visits carrying this ref are named at once, and future ones too.")
        }
        .alert("That did not work", isPresented: isPresent($actionError)) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(actionError ?? "")
        }
    }

    private func switcher(_ pets: [PetRecord]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(pets.enumerated()), id: \.element.id) { index, pet in
                    let isSelected = pet.id == model.selected?.id
                    Button { Task { await model.select(pet) } } label: {
                        HStack(spacing: 8) {
                            PetPhoto(name: pet.name, photoPath: pet.photoPath, tintIndex: index)
                                .frame(width: 24, height: 24)
                                .clipShape(Circle())
                                .accessibilityHidden(true)
                            Text(pet.name).font(Theme.Font.control.weight(.semibold)).lineLimit(1)
                        }
                        .padding(.leading, 6)
                        .padding(.trailing, 14)
                        .frame(height: Theme.Space.chip)
                        .foregroundStyle(isSelected ? Theme.Color.onPrimary : Theme.Color.text)
                        .background(isSelected ? Theme.Color.text : Theme.Color.surface, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
        }
        .scrollClipDisabled()
    }

    private var actions: some View {
        VStack(spacing: 0) {
            if case .loaded(let refs) = model.unbound {
                ForEach(refs) { ref in
                    UnboundRefRow(ref: ref) { refToBind = ref }
                        .disabled(model.selected == nil)
                    RowRule()
                }
            } else if case .failed(let message) = model.unbound {
                BlockError(message: message) { Task { await model.loadUnbound() } }
                    .padding(.vertical, 8)
                RowRule()
            }
            if let pet = model.selected {
                NavigationLink {
                    PetEditView(model: model, petID: pet.id)
                } label: {
                    SettingsRow(title: "Edit \(pet.name)")
                }
                .buttonStyle(.plain)
                RowRule()
            }
            Button { showsImport = true } label: {
                SettingsRow(title: "Import pets from PetKit")
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Theme.Space.pad)
        .padding(.vertical, 4)
        .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }

    private func retryPets() {
        Task { await model.loadPets() }
    }

    private var bindQuestion: String {
        guard let ref = refToBind else { return "Bind this ref?" }
        return "Bind ref \(String(ref.ref)) to \(model.selected?.name ?? "this cat")?"
    }

    private func isPresent<Value>(_ binding: Binding<Value?>) -> Binding<Bool> {
        Binding(get: { binding.wrappedValue != nil }, set: { if !$0 { binding.wrappedValue = nil } })
    }

    private func deleteFace() {
        guard let pet = model.selected, let face = faceToDelete else { return }
        Task {
            do {
                try await session.call(purpose: "Delete a face photo") { try await model.deleteFace(face, of: pet) }
            } catch {
                actionError = Loadable<Void>.message(for: error)
            }
        }
    }

    private func bind() {
        guard let pet = model.selected, let ref = refToBind else { return }
        Task {
            do {
                try await session.call(purpose: "Bind a ref to \(pet.name)") { try await model.bind(ref, to: pet) }
            } catch {
                actionError = Loadable<Void>.message(for: error)
            }
        }
    }
}

#Preview {
    PetsPreview.wrap {
        NavigationStack { PetsView(model: .fixture()) }
    }
}
