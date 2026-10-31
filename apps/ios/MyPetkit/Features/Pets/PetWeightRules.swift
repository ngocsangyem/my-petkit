import Foundation
import PetkitAPI

/// Pure rules of a pet's registered weight, weight matching and the
/// per-device limit, mirroring the server's checks so the edit screen can say
/// what the server would refuse.
enum PetWeightRules {
    /// The server's tolerance when a pet sets none.
    static let defaultToleranceG = 300
    /// Accepted registered weights and tolerances, in grams.
    static let weightRangeG = 200...20_000
    static let toleranceRangeG = 50...2_000
    /// The tolerances the picker offers.
    static let toleranceChoices = Array(stride(from: 50, through: 2_000, by: 50))
    /// A box recognises up to this many cats.
    static let maxPetsPerDevice = 15

    static func tolerance(of pet: PetRecord) -> Int {
        pet.toleranceG.flatMap { $0 > 0 ? $0 : nil } ?? defaultToleranceG
    }

    /// Grams as kilograms with two decimals, "5.43"; always a full stop, so
    /// the figure reads the same as the rest of the app.
    static func kilogramText(_ grams: Int?) -> String {
        guard let grams, grams > 0 else { return "" }
        return String(format: "%.2f", Double(grams) / 1000)
    }

    /// Typed kilograms ("5.43", "5,43", "5.43 kg") as whole grams; nil when
    /// the text is not a number.
    static func grams(fromKilograms text: String) -> Int? {
        var cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if cleaned.hasSuffix("kg") { cleaned = String(cleaned.dropLast(2)).trimmingCharacters(in: .whitespaces) }
        cleaned = cleaned.replacingOccurrences(of: ",", with: ".")
        guard !cleaned.isEmpty, let kilograms = Double(cleaned), kilograms.isFinite, kilograms >= 0 else {
            return nil
        }
        return Int((kilograms * 1000).rounded())
    }

    /// "± 300 g".
    static func toleranceText(_ grams: Int) -> String {
        "± \(grams) g"
    }

    /// The match is refused when another cat sits within twice the
    /// tolerance, so the sentence prints that real number.
    static func matchSentence(toleranceG: Int) -> String {
        L10n.string("Only when no other cat is within \(toleranceG * 2) g.")
    }

    /// "updated 13:58" on the day it changed, "updated 28 Oct" before.
    static func updatedLine(_ ts: Double?, now: Date, zone: TimeZone) -> String? {
        guard let ts, ts.isFinite, ts > 0 else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let date = Date(timeIntervalSince1970: ts)
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = zone
        formatter.locale = L10n.deviceClockLocale
        formatter.dateFormat = calendar.isDate(date, inSameDayAs: now) ? "HH:mm" : "d MMM"
        return L10n.string("updated \(formatter.string(from: date))")
    }

    /// How many cats a device would hold with `pet` on it or off it.
    static func catsOnDevice(_ deviceID: Int, pets: [PetRecord], editing petID: Int, isOn: Bool) -> Int {
        let others = pets.filter { $0.id != petID && $0.deviceIDs.contains(deviceID) }.count
        return others + (isOn ? 1 : 0)
    }

    /// "2 of 15 cats on this box".
    static func capacityLine(_ count: Int, onThisBox: Bool = true) -> String {
        onThisBox ? L10n.string("\(count) of \(maxPetsPerDevice) cats on this box")
            : L10n.string("\(count) of \(maxPetsPerDevice) cats")
    }

    /// The sentence for a refused save: a full box is named, everything else
    /// is the server's own sentence.
    static func saveErrorMessage(_ error: any Error, addedDevices: [PetDevice]) -> String {
        guard let api = APIError.from(error), api.code == "too_many_pets" else {
            return Loadable<Void>.message(for: error)
        }
        let names = addedDevices.map { $0.name.isEmpty ? L10n.string("Device \($0.id)") : $0.name }
        guard !names.isEmpty else { return api.message }
        let list = names.joined(separator: ", ")
        return L10n.string("A box recognises up to \(maxPetsPerDevice) cats, and \(list) already has that many.")
            + " " + L10n.string("Turn it off for another cat first.")
    }
}
