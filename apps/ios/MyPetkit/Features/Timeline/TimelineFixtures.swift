import Foundation

/// Preview data shaped like the art direction's sample day. Paths point at
/// files that do not exist, so pictures show their placeholders.
enum TimelineFixtures {
    /// 2026-10-28 00:00 at UTC+7.
    static let dayStart: Double = 1_793_120_400

    static let pets = [
        TimelineSubject(id: 1, name: "Miso", weightG: 5430),
        TimelineSubject(id: 2, name: "Mochi", weightG: 3860),
    ]

    static let devices = [
        TimelineSubject(id: 10, name: "Litter box", deviceType: "t6"),
        TimelineSubject(id: 11, name: "Feeder", deviceType: "d4h"),
        TimelineSubject(id: 12, name: "Fountain", deviceType: "w5"),
    ]

    static func visit(_ id: Int, pet: (id: Int, name: String), minute: Double,
                      stats: (duration: Double, grams: Double), media: TimelineMedia) -> TimelineEntry {
        let ts = dayStart + minute * 60
        return TimelineEntry(kind: "visit", eventID: id, deviceID: 10, deviceName: "Litter box", ts: ts, displayTs: ts,
                             petID: pet.id, petName: pet.name, petPhotoPath: nil, label: nil,
                             eventKind: "toilet_visit", eventType: "10", durationSec: stats.duration,
                             weight: stats.grams, bits: [], steps: [
                                TimelineStep(eventID: id * 10, eventType: "10", ts: ts, label: "Pet entered",
                                             isDetail: false, media: nil, index: 0),
                                TimelineStep(eventID: id * 10 + 1, eventType: "17", ts: ts + 5,
                                             label: "Illuminator on", isDetail: true, media: nil, index: 1),
                             ], media: media, index: id)
    }

    static func event(_ id: Int, device: (id: Int, name: String), minute: Double,
                      label: (text: String, kind: String), bits: [String]) -> TimelineEntry {
        let ts = dayStart + minute * 60
        return TimelineEntry(kind: "event", eventID: id, deviceID: device.id, deviceName: device.name, ts: ts,
                             displayTs: ts, petID: nil, petName: nil, petPhotoPath: nil, label: label.text,
                             eventKind: label.kind, eventType: "1", durationSec: nil, weight: nil, bits: bits,
                             steps: [], media: TimelineMedia(), index: id)
    }

    static let day = TimelineDayResult(
        date: "2026-10-28", tzOffset: 25_200, toiletingCount: 3, feedingCount: 1, drinkingCount: 0, faultCount: 1,
        entries: [
            visit(1, pet: (1, "Miso"), minute: 838, stats: (115, 5430),
                  media: TimelineMedia(highlight: "clips/1.mp4", snapshot: "snaps/1.jpg",
                                       waste: ["waste/1.jpg", "waste/2.jpg"], health: ["health/1.jpg"])),
            event(2, device: (11, "Feeder"), minute: 720, label: ("Feeder dispensed 15 g", "feeding"),
                  bits: ["on schedule"]),
            visit(3, pet: (2, "Mochi"), minute: 665, stats: (110, 3860),
                  media: TimelineMedia(snapshot: "snaps/3.jpg", videoPending: true)),
            event(4, device: (12, "Fountain"), minute: 370, label: ("Fountain stopped reporting", "error"),
                  bits: ["water 40%"]),
            visit(5, pet: (2, "Mochi"), minute: 227, stats: (92, 3870),
                  media: TimelineMedia(playback: "playback/5.ts")),
        ]
    )

    /// 14:31, nobody recognised, the scale read 5.40 kg; the box reported an
    /// identity no pet holds.
    static let unrecognised: TimelineEntry = {
        let ts = dayStart + 871 * 60
        return TimelineEntry(kind: "visit", eventID: 6, deviceID: 10, deviceName: "Litter box", ts: ts, displayTs: ts,
                             petID: nil, petName: nil, petPhotoPath: nil, label: nil, eventKind: "toilet_visit",
                             eventType: "10", durationSec: 122, weight: 5400, bits: [], steps: [],
                             media: TimelineMedia(), index: 6, unboundPetRef: 7_301_552)
    }()

    /// 11:05, Mochi matched by weight only.
    static let byWeight: TimelineEntry = {
        let ts = dayStart + 665 * 60
        return TimelineEntry(kind: "visit", eventID: 7, deviceID: 10, deviceName: "Litter box", ts: ts, displayTs: ts,
                             petID: 2, petName: "Mochi", petPhotoPath: nil, label: nil, eventKind: "toilet_visit",
                             eventType: "10", durationSec: nil, weight: 3860, bits: [], steps: [],
                             media: TimelineMedia(), index: 7, petSource: "weight")
    }()

    /// A day with an unrecognised visit, a weight match and two light visits,
    /// as the change-cat artboard draws it behind the sheet.
    static let reassignDay = TimelineDayResult(
        date: "2026-10-28", tzOffset: 25_200, toiletingCount: 2, feedingCount: 0, drinkingCount: 0, faultCount: 0,
        entries: [unrecognised, byWeight], passingCount: 2
    )

    static let detail = TimelineEventDetail(
        fields: [.init(label: "Event id", value: "1"), .init(label: "Type", value: "10")],
        code: [.init(label: "Meaning", value: "Toilet visit summary"), .init(label: "Grade", value: "confirmed")],
        decoded: [.init(label: "Pet weight", value: "5430 g")]
    )
}
