import Foundation

/// The one chip selected above the day: everything, one pet, one device, or
/// the light visits `all` leaves out.
enum TimelineFilter: Hashable, Sendable {
    case all
    case pet(Int)
    case device(Int)
    case passing
}

/// A pet or device the chips can name.
struct TimelineSubject: Hashable, Sendable, Identifiable {
    let id: Int
    let name: String
    /// Absolute server path of a pet's photo; nil for devices.
    var photoPath: String?
    var deviceType: String?
    /// A pet's registered weight in grams, when it has one.
    var weightG: Int?
}

/// One chip in the row.
struct TimelineChip: Hashable, Sendable, Identifiable {
    let filter: TimelineFilter
    let title: String
    var photoPath: String?
    var tintIndex = 0

    var id: TimelineFilter { filter }
}

/// The query the timeline route takes for a chip.
struct TimelineQuery: Hashable, Sendable {
    var device: Int?
    var pet: Int?
    /// The route's `filter`; `all` is every session except light visits.
    var filter = "all"
}

enum TimelineFilterRules {
    /// "All", then each pet, then "Light visits · N" when `passingCount` is
    /// given, then each device, in the order the server lists them.
    static func chips(pets: [TimelineSubject], devices: [TimelineSubject],
                      passingCount: Int? = nil) -> [TimelineChip] {
        var chips = [TimelineChip(filter: .all, title: "All")]
        for (index, pet) in pets.enumerated() {
            chips.append(TimelineChip(filter: .pet(pet.id), title: displayName(pet.name, fallback: "Pet \(pet.id)"),
                                      photoPath: pet.photoPath, tintIndex: index))
        }
        if let passingCount {
            chips.append(TimelineChip(filter: .passing, title: "Light visits · \(passingCount)"))
        }
        for device in devices {
            chips.append(TimelineChip(filter: .device(device.id),
                                      title: displayName(device.name, fallback: "Device \(device.id)")))
        }
        return chips
    }

    private static func displayName(_ name: String, fallback: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? fallback : trimmed
    }

    static func query(for filter: TimelineFilter) -> TimelineQuery {
        switch filter {
        case .all: TimelineQuery()
        case .pet(let id): TimelineQuery(pet: id)
        case .device(let id): TimelineQuery(device: id)
        case .passing: TimelineQuery(filter: "passing")
        }
    }

    /// The filter another tab asked for (Home's "latest clip" sets a device
    /// id), or nil when the value is not a device id.
    static func requested(deviceID: String?) -> TimelineFilter? {
        guard let text = deviceID?.trimmingCharacters(in: .whitespaces), let id = Int(text) else { return nil }
        return .device(id)
    }

    /// Keeps the selection when its chip still exists; a pet deleted or a
    /// device removed since falls back to "All" instead of an empty day.
    /// "Light visits" depends on the day, not on a list, so it is always kept.
    static func reconciled(_ filter: TimelineFilter, chips: [TimelineChip]) -> TimelineFilter {
        filter == .passing || chips.contains { $0.filter == filter } ? filter : .all
    }

    /// The light-visits chip shows while the day has some, or while it is selected.
    static func passingChipCount(dayCount: Int?, filter: TimelineFilter) -> Int? {
        let count = dayCount ?? 0
        return count > 0 || filter == .passing ? count : nil
    }
}
