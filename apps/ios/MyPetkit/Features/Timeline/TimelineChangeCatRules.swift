import Foundation

/// What the change-cat sheet can pick for a visit.
enum TimelineCatChoice: Hashable, Sendable {
    case pet(Int)
    /// "No cat, just passing".
    case passing
}

/// One household pet offered in the sheet.
struct TimelineCatCandidate: Hashable, Sendable, Identifiable {
    let pet: TimelineSubject
    let tintIndex: Int
    /// Nearest registered weight to what the scale read.
    let isClosest: Bool
    var id: Int { pet.id }
}

/// The body of `PUT /api/timeline/{id}/pet`. `pet_id` is always written,
/// `null` included: an omitted key and "nobody" must not be confused.
struct TimelineVisitPetRequest: Encodable, Equatable, Sendable {
    let petID: Int?
    let passing: Bool
    let useWeight: Bool
    let applyToRef: Bool

    enum CodingKeys: String, CodingKey {
        case petID = "pet_id", passing, useWeight = "use_weight", applyToRef = "apply_to_ref"
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(petID, forKey: .petID)
        try container.encode(passing, forKey: .passing)
        try container.encode(useWeight, forKey: .useWeight)
        try container.encode(applyToRef, forKey: .applyToRef)
    }
}

/// Pure rules of the "Who used the box?" sheet. Only the server's record
/// changes; nothing here reaches a device.
enum TimelineChangeCatRules {
    /// Only a stored litter-box visit has a cat to change.
    static func canChange(_ entry: TimelineEntry) -> Bool {
        entry.isVisit && entry.eventID != nil
    }

    /// The visit's scale reading in grams, when it has a usable one.
    static func visitGrams(_ entry: TimelineEntry) -> Double? {
        guard let grams = entry.weight, grams.isFinite, grams > 0 else { return nil }
        return grams
    }

    /// Household pets, nearest registered weight first; pets without a
    /// weight, and every pet when the visit has no reading, keep the server's
    /// order. The first one is "closest weight" only when a comparison was made.
    static func candidates(pets: [TimelineSubject], visitGrams: Double?) -> [TimelineCatCandidate] {
        let indexed = pets.enumerated().map { (index: $0.offset, pet: $0.element) }
        guard let visitGrams else {
            return indexed.map { TimelineCatCandidate(pet: $0.pet, tintIndex: $0.index, isClosest: false) }
        }
        func distance(_ pet: TimelineSubject) -> Double? {
            pet.weightG.flatMap { $0 > 0 ? abs(Double($0) - visitGrams) : nil }
        }
        let sorted = indexed.sorted { lhs, rhs in
            switch (distance(lhs.pet), distance(rhs.pet)) {
            case let (left?, right?): left == right ? lhs.index < rhs.index : left < right
            case (.some, .none): true
            case (.none, .some): false
            case (.none, .none): lhs.index < rhs.index
            }
        }
        return sorted.enumerated().map { position, item in
            TimelineCatCandidate(pet: item.pet, tintIndex: item.index,
                                 isClosest: position == 0 && distance(item.pet) != nil)
        }
    }

    /// "Who used the box at 14:31?"
    static func title(_ entry: TimelineEntry, tzOffset: Int) -> String {
        guard let time = TimelineFormat.clock(entry.displayTs ?? entry.ts, tzOffset: tzOffset) else {
            return L10n.string("Who used the box?")
        }
        return L10n.string("Who used the box at \(time)?")
    }

    /// How the visit was attributed, then what the scale read.
    static func context(_ entry: TimelineEntry) -> String {
        let name = entry.petName ?? ""
        let how: String
        switch (entry.hasPet, entry.petSource) {
        case (true, "weight"): how = L10n.string("Matched to \(name) by weight; the camera did not recognise the cat.")
        case (true, "manual"): how = L10n.string("You assigned this visit to \(name).")
        case (true, _): how = L10n.string("The camera recognised \(name).")
        case (false, "manual"):
            how = entry.passing ? L10n.string("You marked this visit as no cat.") : L10n.string("You cleared the cat on this visit.")
        case (false, _):
            how = entry.passing ? L10n.string("Lighter than any registered cat.") : L10n.string("The camera did not recognise the cat.")
        }
        guard let reading = TimelineFormat.weight(visitGrams(entry)) else { return how }
        return L10n.string("\(how) The scale read \(reading).")
    }

    /// "5.43 kg registered · closest weight".
    static func registeredLine(_ candidate: TimelineCatCandidate) -> String {
        guard let grams = candidate.pet.weightG, grams > 0, let text = TimelineFormat.weight(Double(grams)) else {
            return L10n.string("No registered weight")
        }
        return candidate.isClosest ? L10n.string("\(text) registered · closest weight") : L10n.string("\(text) registered")
    }

    /// The row selected when the sheet opens: the visit's current answer.
    static func initialChoice(_ entry: TimelineEntry) -> TimelineCatChoice? {
        if let pet = entry.petID, entry.hasPet { return .pet(pet) }
        return entry.passing ? .passing : nil
    }

    /// Readings the server accepts as a registered weight; outside them it
    /// answers `implausible_weight`, so the switch is not offered.
    static let plausibleGrams = 200.0...20_000.0

    /// "Use this for Miso's weight" needs a pet and a plausible reading.
    static func offersWeight(_ choice: TimelineCatChoice?, entry: TimelineEntry) -> Bool {
        guard case .pet = choice, let grams = visitGrams(entry) else { return false }
        return plausibleGrams.contains(grams.rounded())
    }

    /// Naming the box's identity needs a pet and an identity nobody holds.
    static func offersRef(_ choice: TimelineCatChoice?, entry: TimelineEntry) -> Bool {
        guard case .pet = choice else { return false }
        return entry.unboundPetRef != nil
    }

    /// The body to send, or nil when nothing is picked. A switch that is not
    /// offered for the choice is never sent on.
    static func request(choice: TimelineCatChoice?, useWeight: Bool, applyToRef: Bool,
                        entry: TimelineEntry) -> TimelineVisitPetRequest? {
        switch choice {
        case .pet(let id):
            return TimelineVisitPetRequest(petID: id, passing: false,
                                           useWeight: useWeight && offersWeight(choice, entry: entry),
                                           applyToRef: applyToRef && offersRef(choice, entry: entry))
        case .passing:
            return TimelineVisitPetRequest(petID: nil, passing: true, useWeight: false, applyToRef: false)
        case nil:
            return nil
        }
    }

    /// Save is offered once the answer would change something.
    static func changesSomething(_ request: TimelineVisitPetRequest?, entry: TimelineEntry) -> Bool {
        guard let request else { return false }
        if request.useWeight || request.applyToRef { return true }
        if request.passing { return !(entry.passing && entry.petSource == "manual" && !entry.hasPet) }
        // Confirming a weight match makes it the user's own answer; confirming
        // what the camera or the user already said changes nothing.
        return request.petID != entry.petID || !entry.hasPet || entry.isMatchedByWeight
    }
}
