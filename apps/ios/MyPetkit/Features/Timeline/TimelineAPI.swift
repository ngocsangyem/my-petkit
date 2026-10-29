import Foundation
import PetkitAPI
import PetkitCore

/// The Timeline screen's calls, mapped to the feature's value types.
///
/// The two timeline reads (`getTimeline`, `getTimelineEventDetail`) are made
/// as plain JSON requests rather than through the generated types: the
/// generator drops every `anyOf [schema, null]` property (a step's `media`,
/// which is where a cleaning's waste photos live) and keeps only the first of
/// several non-null types (`pet_ref` is typed string, the server sends an
/// integer), so the typed decode either loses data or fails outright.
@MainActor
struct TimelineAPI {
    let session: ServerSession

    /// One server day. `date` nil asks for the server's today. The server cuts
    /// the day at its local midnight; the app never does. `tz` tells it the
    /// phone's zone (the current contract ignores it and uses its own zone).
    func day(date: String?, query: TimelineQuery) async throws -> TimelineDayResult {
        var items = [URLQueryItem(name: "filter", value: "all"),
                     URLQueryItem(name: "tz", value: TimeZone.current.identifier)]
        if let date { items.append(URLQueryItem(name: "date", value: date)) }
        if let device = query.device { items.append(URLQueryItem(name: "device", value: String(device))) }
        if let pet = query.pet { items.append(URLQueryItem(name: "pet", value: String(pet))) }
        let json = try await session.call(purpose: "Show the timeline") {
            try await getJSON(path: "/api/timeline", query: items)
        }
        guard let result = TimelineJSON.day(json) else { throw URLError(.cannotParseResponse) }
        return result
    }

    func pets() async throws -> [TimelineSubject] {
        try await session.client.listPets().ok.body.json.pets.map {
            TimelineSubject(id: $0.value1.id, name: $0.value1.name,
                            photoPath: $0.value2.faces.first.map { MediaPath.absolute($0.url) })
        }
    }

    func devices() async throws -> [TimelineSubject] {
        try await session.client.listDevices().ok.body.json.map {
            TimelineSubject(id: $0.id, name: $0.name, deviceType: $0._type)
        }
    }

    /// Everything stored about one event.
    func eventDetail(id: Int) async throws -> TimelineEventDetail {
        let json = try await session.call(purpose: "Show this event") {
            try await getJSON(path: "/api/timeline/\(id)", query: [])
        }
        return TimelineEventDetail(json: json)
    }

    /// A GET over the paired session with the bearer token; a refusal is
    /// thrown as the same `APIError` the generated client throws, so the
    /// block shows the server's own sentence.
    private func getJSON(path: String, query: [URLQueryItem]) async throws -> JSONValue {
        guard let base = session.url(forPath: path),
              var components = URLComponents(url: base, resolvingAgainstBaseURL: true) else {
            throw URLError(.badURL)
        }
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(session.paired.token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else {
            throw TimelineJSON.apiError(status: http.statusCode, data: data)
        }
        return try JSONDecoder().decode(JSONValue.self, from: data)
    }
}

/// The event detail as the screen shows it: a few labelled fields, the
/// code-table entry and the decoded content, all as text.
struct TimelineEventDetail: Hashable, Sendable {
    struct Field: Hashable, Sendable, Identifiable {
        let label: String
        let value: String
        var note: String?
        var id: String { label }
    }

    let fields: [Field]
    let code: [Field]
    let decoded: [Field]

    init(fields: [Field], code: [Field], decoded: [Field]) {
        self.fields = fields
        self.code = code
        self.decoded = decoded
    }

    init(json: JSONValue) {
        let event = json["event"]
        let eventKeys: [(String, String)] = [
            ("id", "Event id"), ("event_type", "Type"), ("event_kind", "Kind"), ("label", "Label"),
            ("source", "Source"), ("device_type", "Device type"), ("device_id", "Device id"),
            ("pet_name", "Pet"), ("pet_ref", "Device's pet ref"), ("score", "Match score"),
            ("related_event", "Session"), ("parent_event", "Parent event"), ("event_uid", "Dedup key"),
        ]
        fields = eventKeys.compactMap { key, label in
            event?[key]?.string.map { Field(label: label, value: $0) }
        }
        let codeEntry = json["code"]
        let codeKeys: [(String, String)] = [
            ("label", "Meaning"), ("kind", "Kind"), ("grade", "Grade"), ("role", "Role"),
            ("firmware", "Firmware function"), ("note", "Note"),
        ]
        code = codeKeys.compactMap { key, label in
            guard let value = codeEntry?[key]?.string, !value.isEmpty else { return nil }
            return Field(label: label, value: value)
        }
        if case .array(let rows)? = json["decoded"] {
            decoded = rows.compactMap { row in
                guard let label = row["label"]?.string ?? row["key"]?.string else { return nil }
                let note = row["note"]?.string.flatMap { $0.isEmpty ? nil : $0 }
                return Field(label: label, value: row["text"]?.string ?? "—", note: note)
            }
        } else {
            decoded = []
        }
    }
}
