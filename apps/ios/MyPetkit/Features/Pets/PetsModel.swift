import Foundation
import Observation

/// State of the Pets tab. Each block (pets, devices, unbound identities, the
/// visits card) loads and fails on its own; every mutation reloads what it
/// changed, so a saved change is a visible change.
@MainActor
@Observable
final class PetsModel {
    private(set) var pets: Loadable<[PetRecord]> = .loading
    private(set) var devices: [PetDevice] = []
    private(set) var unbound: Loadable<[UnboundPetRef]> = .loading
    private(set) var visits: [Int: Loadable<PetVisitWeek>] = [:]
    var selectedID: Int?

    /// Fixture models never reach for the network.
    @ObservationIgnored private let isFixture: Bool
    @ObservationIgnored private var api: PetsAPI?

    init() {
        isFixture = false
    }

    init(fixturePets: [PetRecord], devices: [PetDevice], unbound: [UnboundPetRef], visits: [Int: PetVisitWeek]) {
        isFixture = true
        pets = .loaded(fixturePets)
        self.devices = devices
        self.unbound = .loaded(unbound)
        self.visits = visits.mapValues { .loaded($0) }
        selectedID = fixturePets.first?.id
    }

    var selected: PetRecord? {
        guard let list = pets.value else { return nil }
        return list.first { $0.id == selectedID } ?? list.first
    }

    func tintIndex(of pet: PetRecord) -> Int {
        pets.value?.firstIndex { $0.id == pet.id } ?? 0
    }

    var aiDevices: [PetDevice] { devices.filter(\.supportsAI) }

    func attach(_ session: ServerSession) {
        if api == nil { api = PetsAPI(client: session.client) }
    }

    func load() async {
        guard !isFixture, api != nil else { return }
        async let pets: Void = loadPets()
        async let devices: Void = loadDevices()
        async let unbound: Void = loadUnbound()
        _ = await (pets, devices, unbound)
    }

    func loadPets() async {
        guard let api else { return }
        if pets.value == nil { pets = .loading }
        do {
            let list = try await api.pets()
            pets = .loaded(list)
            if selectedID == nil || !list.contains(where: { $0.id == selectedID }) {
                selectedID = list.first?.id
            }
            await loadVisits(force: false)
        } catch {
            pets = .failed(Loadable<Void>.message(for: error))
        }
    }

    func loadDevices() async {
        guard let api else { return }
        // Device names and photo readback are decoration on this screen: a
        // failure leaves the lines generic rather than blanking a block.
        devices = (try? await api.devices()) ?? devices
    }

    func loadUnbound() async {
        guard let api else { return }
        do {
            unbound = .loaded(try await api.unbound())
        } catch {
            unbound = .failed(Loadable<Void>.message(for: error))
        }
    }

    /// The visits card of the selected pet; kept per pet so switching back is instant.
    func loadVisits(force: Bool) async {
        guard let api, let pet = selected else { return }
        if !force, visits[pet.id]?.value != nil { return }
        visits[pet.id] = .loading
        do {
            visits[pet.id] = .loaded(try await api.visitWeek(petID: pet.id))
        } catch {
            visits[pet.id] = .failed(Loadable<Void>.message(for: error))
        }
    }

    func select(_ pet: PetRecord) async {
        selectedID = pet.id
        await loadVisits(force: false)
    }

    // MARK: Mutations

    private func requireAPI() throws -> PetsAPI {
        guard let api else { throw URLError(.cannotConnectToHost) }
        return api
    }

    func create(name: String, deviceIDs: [Int]) async throws {
        try await requireAPI().create(name: name, deviceIDs: deviceIDs)
        await loadPets()
        selectedID = pets.value?.last { $0.name == name }?.id ?? selectedID
    }

    func rename(_ pet: PetRecord, to name: String) async throws {
        try await requireAPI().rename(petID: pet.id, name: name)
        await loadPets()
    }

    func delete(_ pet: PetRecord) async throws {
        try await requireAPI().delete(petID: pet.id)
        pet.faces.forEach { MediaImageCache.shared.remove($0.path) }
        visits[pet.id] = nil
        if selectedID == pet.id { selectedID = nil }
        await loadPets()
    }

    func addFace(to pet: PetRecord, jpeg: Data) async throws {
        try await requireAPI().addFace(petID: pet.id, jpeg: jpeg)
        await loadPets()
    }

    func deleteFace(_ face: PetFaceRef, of pet: PetRecord) async throws {
        try await requireAPI().deleteFace(petID: pet.id, faceID: face.id)
        MediaImageCache.shared.remove(face.path)
        await loadPets()
    }

    func bind(_ ref: UnboundPetRef, to pet: PetRecord) async throws {
        try await requireAPI().bind(ref: ref.ref, to: pet.id)
        async let pets: Void = loadPets()
        async let unbound: Void = loadUnbound()
        _ = await (pets, unbound)
    }

    func importPets(deviceID: Int) async throws -> String {
        let summary = try await requireAPI().importPets(deviceID: deviceID)
        async let pets: Void = loadPets()
        async let unbound: Void = loadUnbound()
        _ = await (pets, unbound)
        return summary
    }
}

extension PetsModel {
    static func fixture() -> PetsModel {
        let miso = PetRecord(id: 1, name: "Miso", deviceIDs: [10], aliasIDs: [], weight: 5430,
                             faces: [PetFaceRef(id: 1, path: "/api/pets/1/faces/1/photo"),
                                     PetFaceRef(id: 2, path: "/api/pets/1/faces/2/photo")])
        let mochi = PetRecord(id: 2, name: "Mochi", deviceIDs: [10], aliasIDs: [], weight: nil, faces: [])
        let box = PetDevice(id: 10, name: "Litter box", deviceType: "t6", supportsAI: true, cachedFaceIDs: ["1", "2"])
        let feeder = PetDevice(id: 11, name: "Kitchen feeder", deviceType: "d4h", supportsAI: false)
        let days = ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"]
        let week = PetVisitWeek(days: zip(days, [3, 4, 3, 5, 3, 4, 2]).map { PetVisitDay(date: $0, count: $1) },
                                today: "2026-10-28", lastWeight: 5430, lastVisit: 1_793_170_680, tzOffset: 25_200)
        return PetsModel(fixturePets: [miso, mochi], devices: [box, feeder],
                         unbound: [UnboundPetRef(ref: 7_301_552, count: 3, lastSeen: 1_793_166_000)],
                         visits: [1: week])
    }
}
