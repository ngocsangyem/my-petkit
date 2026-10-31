import Foundation

/// The fields of `POST /api/pets/{id}` a save sends; nil leaves a field as it is.
struct PetUpdate: Equatable, Sendable {
    var name: String?
    var weightG: Int?
    var toleranceG: Int?
    var matchesByWeight: Bool?
    var deviceIDs: [Int]?

    var isEmpty: Bool {
        name == nil && weightG == nil && toleranceG == nil && matchesByWeight == nil && deviceIDs == nil
    }
}

/// Why a draft cannot be saved, in the words the screen shows.
enum PetEditError: LocalizedError, Equatable {
    case missingName
    case weightOutOfRange

    var errorDescription: String? {
        switch self {
        case .missingName: L10n.string("A cat needs a name.")
        case .weightOutOfRange: L10n.string("Enter a registered weight from 0.20 to 20.00 kg.")
        }
    }
}

/// What the edit screen holds until Done: name, registered weight as typed,
/// weight matching and the devices that get the pet's photos.
struct PetEditDraft: Equatable {
    var name: String
    var weightText: String
    var matchesByWeight: Bool
    var toleranceG: Int
    var deviceIDs: Set<Int>

    init(pet: PetRecord) {
        name = pet.name
        weightText = PetWeightRules.kilogramText(pet.weightG)
        matchesByWeight = pet.matchesByWeight
        toleranceG = PetWeightRules.tolerance(of: pet)
        deviceIDs = Set(pet.deviceIDs)
    }

    /// The changes against `pet`, validated as the server would.
    func changes(from pet: PetRecord) throws -> PetUpdate {
        guard let validName = PetRules.validName(name) else { throw PetEditError.missingName }
        var change = PetUpdate()
        if validName != pet.name { change.name = validName }
        if weightText != PetWeightRules.kilogramText(pet.weightG) {
            // The generated request cannot send `null`, so a registered
            // weight can be corrected but not removed here.
            guard let grams = PetWeightRules.grams(fromKilograms: weightText),
                  PetWeightRules.weightRangeG.contains(grams) else { throw PetEditError.weightOutOfRange }
            if grams != pet.weightG { change.weightG = grams }
        }
        if matchesByWeight != pet.matchesByWeight { change.matchesByWeight = matchesByWeight }
        if toleranceG != PetWeightRules.tolerance(of: pet) { change.toleranceG = toleranceG }
        if deviceIDs != Set(pet.deviceIDs) { change.deviceIDs = deviceIDs.sorted() }
        return change
    }

    /// Devices this draft turns on that the pet was not on yet.
    func addedDeviceIDs(from pet: PetRecord) -> Set<Int> {
        deviceIDs.subtracting(pet.deviceIDs)
    }
}
