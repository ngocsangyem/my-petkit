import Foundation
import PetkitAPI

/// The Pets screens' calls, mapped to the feature's own value types so views,
/// previews and tests never touch the generated schema.
@MainActor
struct PetsAPI {
    let client: Client

    func pets() async throws -> [PetRecord] {
        try await client.listPets().ok.body.json.pets.map(PetRecord.init)
    }

    func unbound() async throws -> [UnboundPetRef] {
        try await client.listUnboundPetRefs().ok.body.json.unbound.map {
            UnboundPetRef(ref: $0.petRef, count: $0.count, lastSeen: $0.lastTs)
        }
    }

    /// Every registered device, with `discernPic` for the ones that recognise.
    /// A recognising device whose detail fails keeps its summary and reads as
    /// "not confirmed", as the web app does.
    func devices() async throws -> [PetDevice] {
        let summaries = try await client.listDevices().ok.body.json
        var devices: [PetDevice] = []
        for summary in summaries {
            var device = PetDevice(id: summary.id, name: summary.name, deviceType: summary._type,
                                   supportsAI: summary.supportsAi, cachedFaceIDs: nil)
            if summary.supportsAi,
               let detail = try? await client.getDevice(path: .init(id: summary.id)).ok.body.json {
                let raw = detail.state?.additionalProperties.value["discernPic"]
                device.cachedFaceIDs = PetRules.faceIDStrings(raw.flatMap { $0 })
            }
            devices.append(device)
        }
        return devices
    }

    func create(name: String, deviceIDs: [Int]) async throws {
        _ = try await client.createPet(body: .json(.init(name: name, deviceIds: deviceIDs))).ok
    }

    /// Sends only what changed: re-sending an unchanged weight would stamp
    /// `weight_updated_at` as if somebody had typed it now.
    func update(petID: Int, _ change: PetUpdate) async throws {
        _ = try await client.updatePet(path: .init(id: petID), body: .json(.init(
            name: change.name, deviceIds: change.deviceIDs, weightG: change.weightG,
            weightToleranceG: change.toleranceG, weightMatch: change.matchesByWeight
        ))).ok
    }

    func delete(petID: Int) async throws {
        _ = try await client.deletePet(path: .init(id: petID)).ok
    }

    func addFace(petID: Int, jpeg: Data) async throws {
        do {
            _ = try await client.addPetFace(path: .init(id: petID), body: .jpeg(HTTPBody(jpeg))).ok
        } catch {
            // A 413 is answered in plain text before the handler runs, so it
            // carries no message of its own.
            if APIError.from(error)?.status == 413 { throw PetsError.photoTooLarge }
            throw error
        }
    }

    func deleteFace(petID: Int, faceID: Int) async throws {
        _ = try await client.deletePetFace(path: .init(id: petID, faceId: faceID)).ok
    }

    /// Binds a device-reported identity. The alias list is replaced wholesale,
    /// so the current list is read first; binding without it would silently
    /// drop an earlier binding.
    func bind(ref: Int, to petID: Int) async throws {
        let pet = try await client.getPet(path: .init(id: petID)).ok.body.json.pet
        let aliases = PetRules.withAlias(pet.devicePetIdsJson, ref: ref)
        _ = try await client.updatePet(path: .init(id: petID), body: .json(.init(devicePetIds: aliases))).ok
    }

    /// Asks the PetKit cloud once for the pets this device recognises.
    func importPets(deviceID: Int) async throws -> String {
        let results = try await client.importPetsFromPetkit(body: .json(.init(deviceId: deviceID))).ok.body.json.results
        return PetRules.importSummary(results.map {
            PetImportOutcome(imported: $0.outcome == .imported, facesImported: $0.facesImported ?? 0,
                             facesOffered: $0.facesOffered ?? 0, boundEvents: $0.boundEvents ?? 0,
                             deviceFull: $0.outcome == .deviceFull)
        })
    }

    /// Litter-box visits per day for the last `days` server days, oldest first,
    /// read from the timeline's per-day `counts`. The server cuts each day; the
    /// app only names it. Past days ask for a filter that matches no session,
    /// which the API answers with the counts and an empty list.
    func visitWeek(petID: Int, days: Int = 7) async throws -> PetVisitWeek {
        let today = try await client.getTimeline(query: .init(pet: petID, filter: "toileting")).ok.body.json
        let latest = today.sessions
            .filter { $0.kind == "visit" }
            .max { ($0.displayTs ?? $0.ts ?? 0) < ($1.displayTs ?? $1.ts ?? 0) }
        var counts: [PetVisitDay] = [PetVisitDay(date: today.date, count: today.counts.toileting)]
        let client = client
        try await withThrowingTaskGroup(of: PetVisitDay.self) { group in
            for offset in 1..<max(days, 1) {
                guard let date = TimelineFormat.shiftDay(today.date, by: -offset) else { continue }
                group.addTask {
                    let day = try await client.getTimeline(
                        query: .init(pet: petID, filter: PetsAPI.countsOnlyFilter, date: date)
                    ).ok.body.json
                    return PetVisitDay(date: day.date, count: day.counts.toileting)
                }
            }
            for try await day in group { counts.append(day) }
        }
        return PetVisitWeek(days: counts.sorted { $0.date < $1.date }, today: today.date,
                            lastWeight: latest?.weight, lastVisit: latest?.displayTs ?? latest?.ts,
                            tzOffset: today.tzOffset)
    }

    /// The API documents that an unknown filter matches nothing; the counts
    /// are computed before the filter, so they still arrive.
    nonisolated static let countsOnlyFilter = "counts-only"
}

enum PetsError: LocalizedError {
    case photoTooLarge

    var errorDescription: String? { L10n.string("That photo is too large.") }
}

/// One server day's visit count.
struct PetVisitDay: Hashable, Sendable {
    let date: String
    let count: Int
}

/// The visits card's data: per-day counts plus today's last weighed visit.
struct PetVisitWeek: Hashable, Sendable {
    let days: [PetVisitDay]
    let today: String
    let lastWeight: Double?
    let lastVisit: Double?
    let tzOffset: Int
}

extension PetRecord {
    init(_ row: Components.Schemas.PetWithFaces) {
        let pet = row.value1
        self.init(
            id: pet.id,
            name: pet.name,
            deviceIDs: PetRules.parseIDList(pet.deviceIdsJson),
            aliasIDs: PetRules.parseIDList(pet.devicePetIdsJson),
            weight: pet.weight,
            faces: row.value2.faces.map { PetFaceRef(id: $0.id, path: MediaPath.absolute($0.url)) },
            weightG: pet.weightG,
            weightUpdatedAt: pet.weightUpdatedAt,
            toleranceG: pet.weightToleranceG,
            matchesByWeight: (pet.weightMatch ?? 1) != 0
        )
    }
}
