import Foundation
import PetkitAPI
import PetkitCore

/// Reads the timeline route's JSON into the feature's value types. Tolerant
/// on purpose: an id or event type may arrive as a number or a string, and a
/// missing optional field is nil rather than a failed day.
enum TimelineJSON {
    static func day(_ json: JSONValue) -> TimelineDayResult? {
        guard let date = json["date"]?.string else { return nil }
        let counts = json["counts"]
        func count(_ key: String) -> Int { int(counts?[key]) ?? 0 }
        let entries = array(json["sessions"]).enumerated().map { entry($0.element, index: $0.offset) }
        return TimelineDayResult(
            date: date, tzOffset: int(json["tz_offset"]) ?? 0,
            toiletingCount: count("toileting"), feedingCount: count("feeding"),
            drinkingCount: count("drinking"), faultCount: count("fault"),
            entries: entries.sorted { $0.sortTime > $1.sortTime },
            passingCount: count("passing")
        )
    }

    static func entry(_ json: JSONValue, index: Int) -> TimelineEntry {
        TimelineEntry(
            kind: string(json["kind"]) ?? "event",
            eventID: int(json["id"]),
            deviceID: int(json["device_id"]),
            deviceName: string(json["device_name"]) ?? "",
            ts: number(json["ts"]),
            displayTs: number(json["display_ts"]),
            petID: int(json["pet_id"]),
            petName: string(json["pet_name"]),
            petPhotoPath: string(json["pet_photo_url"]).map(MediaPath.absolute),
            label: string(json["label"]),
            eventKind: string(json["event_kind"]),
            eventType: string(json["event_type"]),
            durationSec: number(json["duration_sec"]),
            weight: number(json["weight"]),
            bits: array(json["bits"]).compactMap(string),
            steps: array(json["sub_events"]).enumerated().map { offset, step in
                TimelineStep(eventID: int(step["id"]), eventType: string(step["event_type"]),
                             ts: number(step["ts"]), label: string(step["label"]),
                             isDetail: bool(step["detail"]) ?? false, media: media(step["media"]), index: offset)
            },
            media: media(json["media"]) ?? TimelineMedia(),
            index: index,
            petSource: string(json["pet_source"]),
            passing: bool(json["passing"]) ?? false,
            unboundPetRef: int(json["unbound_pet_ref"])
        )
    }

    static func media(_ json: JSONValue?) -> TimelineMedia? {
        guard let json, case .object = json else { return nil }
        return TimelineMedia(
            highlight: string(json["highlight_url"]), playback: string(json["playback_url"]),
            preview: string(json["preview_url"]), poster: string(json["poster_url"]),
            snapshot: string(json["snapshot_url"]),
            waste: array(json["waste"]).compactMap(string), health: array(json["health"]).compactMap(string),
            videoPending: bool(json["video_pending"]) ?? false
        )
    }

    /// The error envelope `{"error": {"code", "message"}}` as an `APIError`.
    static func apiError(status: Int, data: Data) -> APIError {
        let json = try? JSONDecoder().decode(JSONValue.self, from: data)
        let error = json?["error"]
        if let message = string(error?["message"]) {
            return APIError(status: status, code: string(error?["code"]) ?? "http_\(status)", message: message)
        }
        // A few early refusals answer `{"error": "sentence"}`.
        if let message = string(error) {
            return APIError(status: status, code: "http_\(status)", message: message)
        }
        return APIError(status: status, code: "http_\(status)",
                        message: HTTPURLResponse.localizedString(forStatusCode: status).capitalized)
    }

    // MARK: Scalars

    static func string(_ value: JSONValue?) -> String? {
        guard let value else { return nil }
        if case .null = value { return nil }
        return value.string
    }

    static func number(_ value: JSONValue?) -> Double? {
        guard let value, case .number(let number) = value, number.isFinite else {
            if case .string(let text)? = value { return Double(text) }
            return nil
        }
        return number
    }

    static func int(_ value: JSONValue?) -> Int? {
        guard let number = number(value), number.rounded() == number, abs(number) < 1e15 else { return nil }
        return Int(number)
    }

    static func bool(_ value: JSONValue?) -> Bool? {
        if case .bool(let flag)? = value { return flag }
        return nil
    }

    static func array(_ value: JSONValue?) -> [JSONValue] {
        if case .array(let items)? = value { return items }
        return []
    }
}
