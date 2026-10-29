import Foundation

/// The server's upload limits (`features/sounds/routes.py`), checked here in
/// the same order so a file that cannot be stored is refused before it is
/// sent. The server still has the last word, and its refusal is shown too.
enum SoundUploadPolicy {
    /// `MAX_SOUNDS_PER_DEVICE`.
    static let maxSounds = 10
    /// `MAX_SOUND_SIZE`: 2 MiB.
    static let maxBytes = 2 * 1024 * 1024

    /// Why this upload would be refused, or nil when the server would take it.
    static func problem(existingCount: Int, byteCount: Int, fileName: String) -> String? {
        if existingCount >= maxSounds {
            return "A device holds at most \(maxSounds) sounds. Delete one first."
        }
        if byteCount > maxBytes {
            return "\(fileName) is larger than 2 MB."
        }
        if byteCount <= 0 {
            return "\(fileName) is empty."
        }
        return nil
    }

    /// "180 KB", "1.2 MB".
    static func formatSize(_ bytes: Int) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }
}

/// A device setting shown on the sounds screen, read from the device's
/// entities. A model without the entity has no row at all.
struct SoundVolumeSetting: Equatable, Sendable {
    let key: String
    let value: Int?
    let range: ClosedRange<Int>
    /// False for a value the server reports but cannot write.
    let isSettable: Bool

    /// "6 of 9", or an em dash when the device never reported it.
    var display: String { value.map { "\($0) of \(range.upperBound)" } ?? "—" }
}

struct SoundLanguageSetting: Equatable, Sendable {
    let key: String
    /// The labels the server takes as the written value.
    let options: [String]
    /// The option the device reports, nil when it matches none.
    let selectedIndex: Int?
    let isSettable: Bool

    var display: String { selectedIndex.map { options[$0] } ?? "Not reported" }
}

enum SoundSettings {
    static let volumeKey = "volume"
    static let languageKey = "voice_language"

    /// The volume entity, when this model has one with a range.
    static func volume(in entities: [ScheduleJSON]) -> SoundVolumeSetting? {
        guard let entity = findEntity(volumeKey, in: entities), entity["component"].text == "number",
              let low = entity["min"].int, let high = entity["max"].int, low <= high else { return nil }
        return SoundVolumeSetting(key: volumeKey, value: entity["value"].int, range: low...high,
                                  isSettable: entity["settable"] == .bool(true))
    }

    /// The voice-language select. A device value maps to an option through
    /// `option_values`, or by bare index when the entity declares none, as
    /// the server's own template does.
    static func language(in entities: [ScheduleJSON]) -> SoundLanguageSetting? {
        guard let entity = findEntity(languageKey, in: entities), entity["component"].text == "select" else { return nil }
        let labels = entity["options"].array.map(\.text)
        guard !labels.isEmpty else { return nil }
        let declared = entity["option_values"].array
        let values = declared.isEmpty ? labels.indices.map { ScheduleJSON.int($0) } : declared
        let current = entity["value"]
        let index = values.firstIndex { $0.text == current.text && !current.text.isEmpty }
        return SoundLanguageSetting(key: languageKey, options: labels, selectedIndex: index,
                                    isSettable: entity["settable"] == .bool(true))
    }

    private static func findEntity(_ key: String, in entities: [ScheduleJSON]) -> ScheduleJSON? {
        entities.first { $0["key"].text == key }
    }
}
