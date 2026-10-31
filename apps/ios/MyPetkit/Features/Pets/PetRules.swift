import Foundation

/// One reference photo of a pet: its id and the server path of the JPEG.
struct PetFaceRef: Hashable, Sendable, Identifiable {
    let id: Int
    /// Absolute server path, `/api/pets/{pet}/faces/{id}/photo`.
    let path: String
}

/// A pet as the screens use it: the JSON-in-a-string columns already parsed.
struct PetRecord: Hashable, Sendable, Identifiable {
    let id: Int
    var name: String
    var deviceIDs: [Int]
    var aliasIDs: [Int]
    /// Legacy free-form weight, stored by the server as given.
    var weight: Double?
    var faces: [PetFaceRef]
    /// Registered weight in whole grams; what the weight rules read.
    var weightG: Int?
    var weightUpdatedAt: Double?
    /// Nil is the server's default (`PetRules.defaultToleranceG`).
    var toleranceG: Int?
    /// Visits the camera did not recognise may be matched to this pet by weight.
    var matchesByWeight = true

    /// The photo that stands for the pet: its first face, as the server's
    /// timeline does (`pet_photo_url` is the first face too).
    var photoPath: String? { faces.first?.path }
}

/// A device as the Pets screens need it: what it is called and which of our
/// face photos it says it downloaded.
struct PetDevice: Hashable, Sendable, Identifiable {
    let id: Int
    let name: String
    let deviceType: String
    let supportsAI: Bool
    /// `discernPic` from the state report, or nil when the device never sent it.
    var cachedFaceIDs: [String]?
}

/// A device-reported identity that matches no pet.
struct UnboundPetRef: Hashable, Sendable, Identifiable {
    let ref: Int
    let count: Int
    let lastSeen: Double?
    var id: Int { ref }
}

/// One identity's outcome of an import from the PetKit cloud.
struct PetImportOutcome: Hashable, Sendable {
    let imported: Bool
    let facesImported: Int
    let facesOffered: Int
    let boundEvents: Int
    /// Left out because the device already holds as many cats as it can.
    var deviceFull = false
}

/// Pure rules of the Pets screens. Mirrors the web app's `pet-model.ts`.
enum PetRules {
    /// The server refuses the seventh photo (`MAX_FACES_PER_PET`).
    static let maxFaces = 6

    /// The numbers inside a JSON-array column such as `device_ids_json`. An
    /// unreadable value reads as an empty list: a pet linked to nothing reads
    /// better than a broken screen.
    static func parseIDList(_ json: String?) -> [Int] {
        guard let data = json?.data(using: .utf8),
              let value = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]),
              let array = value as? [Any] else { return [] }
        return array.compactMap { element in
            if let number = element as? NSNumber {
                let double = number.doubleValue
                return double.isFinite && double.rounded() == double ? Int(double) : nil
            }
            if let text = element as? String { return Int(text) }
            return nil
        }
    }

    /// The alias list after binding `ref`. Additive: binding a second identity
    /// must not drop the first, so the current list is read before it is written.
    static func withAlias(_ current: String?, ref: Int) -> [Int] {
        let ids = parseIDList(current)
        return ids.contains(ref) ? ids : ids + [ref]
    }

    /// "on 2 devices", or "No device assigned".
    static func assignedLine(_ count: Int) -> String {
        count == 0 ? L10n.string("No device assigned") : L10n.string("on \(count) devices")
    }

    /// "3.4": one decimal. English keeps the point whatever the phone's
    /// region; another language takes the phone region's separator ("3,4"
    /// in vi_VN, "3.4" in vi_US).
    static func oneDecimal(_ value: Double) -> String {
        guard AppLanguageStore.shared.language != .english else { return String(format: "%.1f", value) }
        return value.formatted(.number.precision(.fractionLength(1)).grouping(.never).locale(L10n.locale))
    }

    /// The face ids in a device's `discernPic` readback, as strings, or nil
    /// when the value is not a list (the device never reported it).
    static func faceIDStrings(_ raw: Any?) -> [String]? {
        guard let array = raw as? [Any?] else { return nil }
        return array.compactMap { element -> String? in
            switch element {
            case let value as Int: String(value)
            case let value as Double:
                if value.rounded() == value, abs(value) < 1e15 { String(Int(value)) } else { String(value) }
            case let value as String: value
            default: nil
            }
        }
    }

    /// How many of `faceIDs` the device says it holds, or nil when it never reported.
    static func loadedCount(faceIDs: [Int], cached: [String]?) -> Int? {
        guard let cached else { return nil }
        let held = Set(cached)
        return faceIDs.filter { held.contains(String($0)) }.count
    }

    /// The line under a device in the edit screen.
    static func deviceFaceLine(device: PetDevice, faceIDs: [Int]) -> String {
        guard device.supportsAI else { return L10n.string("No face recognition on this model") }
        if faceIDs.isEmpty { return L10n.string("No face photos yet") }
        guard let loaded = loadedCount(faceIDs: faceIDs, cached: device.cachedFaceIDs) else {
            return L10n.string("Face photos sent · not confirmed yet")
        }
        return L10n.string("Face photos sent · \(loaded) of \(faceIDs.count) loaded")
    }

    /// The sentence under the pet's name on the Pets screen.
    static func recognitionLine(pet: PetRecord, devices: [PetDevice]) -> String {
        let assigned = devices.filter { pet.deviceIDs.contains($0.id) }
        let onDevices = assignedLine(pet.deviceIDs.count)
        if pet.faces.isEmpty { return L10n.string("\(onDevices) · no face photos yet") }
        let faceIDs = pet.faces.map(\.id)
        let holding = assigned.filter { device in
            device.supportsAI && loadedCount(faceIDs: faceIDs, cached: device.cachedFaceIDs) == faceIDs.count
        }
        if !holding.isEmpty { return L10n.string("\(onDevices) · recognised on the device") }
        if assigned.contains(where: \.supportsAI) { return L10n.string("\(onDevices) · waiting for the device to fetch") }
        return onDevices
    }

    /// The sentence after an import. A photo can be refused after it downloads
    /// (it has to be a real JPEG), and the bound count is history just named.
    static func importSummary(_ results: [PetImportOutcome]) -> String {
        let imported = results.filter(\.imported)
        let full = results.filter(\.deviceFull).count
        let leftOut = L10n.string("\(full) pets left out")
        let fullNote = full > 0
            ? " " + L10n.string("\(leftOut): the device already holds \(PetWeightRules.maxPetsPerDevice) cats.")
            : ""
        guard !imported.isEmpty else {
            if full > 0 { return L10n.string("Nothing imported.") + fullNote }
            return L10n.string("Nothing new: PetKit lists no pets this device does not already have.")
        }
        let photos = imported.reduce(0) { $0 + $1.facesImported }
        let offeredCount = imported.reduce(0) { $0 + $1.facesOffered }
        let offered = L10n.string("\(offeredCount) photos")
        let named = imported.reduce(0) { $0 + $1.boundEvents }
        var parts = [L10n.string("Imported \(imported.count) pets"), L10n.string("\(photos) of \(offered)")]
        if named > 0 { parts.append(L10n.string("named \(named) past events")) }
        return parts.joined(separator: ", ") + "." + fullNote
    }

    /// Visits per day on average over the days that have a count.
    static func averagePerDay(_ counts: [Int]) -> Double? {
        guard !counts.isEmpty else { return nil }
        return Double(counts.reduce(0, +)) / Double(counts.count)
    }

    /// A name the server will accept: trimmed and not empty.
    static func validName(_ text: String) -> String? {
        let name = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? nil : name
    }
}
