import Foundation
import PetkitAPI
import PetkitCore

/// The device screens' reads, plus the one write the generated client cannot
/// express. Reads go over the paired session with the client token and decode
/// into `DeviceRecords` (see the note there for why not the generated types).
/// Every refusal is thrown as the server's own `APIError`.
@MainActor
struct DevicesAPI {
    let session: ServerSession

    func devices() async throws -> [DeviceRecord] {
        try await get("/api/devices")
    }

    func device(_ id: Int) async throws -> DeviceRecord {
        try await get("/api/devices/\(id)")
    }

    func accessories() async throws -> [BleAccessoryRecord] {
        let list: BleAccessoryList = try await get("/api/ble")
        return list.accessories
    }

    func pets() async throws -> [HomePetRecord] {
        let list: PetList = try await get("/api/pets")
        return list.pets
    }

    /// Sessions of the server's today and of the day before. The timeline cuts
    /// days in the SERVER's zone; a device in another zone has a today that can
    /// start in the server's yesterday, so both are read and the caller keeps
    /// each device's own today.
    func recentSessions(device: Int? = nil) async throws -> [TimelineSessionRecord] {
        var query = device.map { [URLQueryItem(name: "device", value: String($0))] } ?? []
        let today: TimelineDayRecord = try await get("/api/timeline", query: query)
        guard let before = Self.previousDay(today.date) else { return today.sessions }
        query.append(URLQueryItem(name: "date", value: before))
        let yesterday: TimelineDayRecord = try await get("/api/timeline", query: query)
        return yesterday.sessions + today.sessions
    }

    /// `POST /api/devices/{id}/command` with a named action. Resolves to the
    /// sentence for the person who pressed the button.
    func runAction(_ id: Int, action: String) async throws -> String {
        try await command(id, ["action": .string(action), "transport": .string("auto")])
    }

    /// `POST /api/devices/{id}/command` writing an entity. The value goes as
    /// typed; the server coerces and validates it.
    func setEntity(_ id: Int, entity: String, value: String) async throws -> String {
        try await command(id, ["entity": .string(entity), "value": .string(value), "transport": .string("auto")])
    }

    /// The command result is read for `delivered` only: its `envelope` may be
    /// any JSON type, which the generated result type cannot hold.
    private func command(_ id: Int, _ body: [String: JSONValue]) async throws -> String {
        let data = try await send("POST", "/api/devices/\(id)/command", json: JSONEncoder().encode(body))
        struct Result: Decodable { let delivered: String }
        let delivered = (try? JSONDecoder().decode(Result.self, from: data))?.delivered ?? "unknown"
        return DeliveryText.command(delivered)
    }

    /// `POST /api/devices/{id}/timezone`. Clearing the override needs an explicit
    /// `{"timezone": null}`, which the generated request type drops as nil.
    /// Resolves to the sentence for the person who pressed the button.
    func setTimezone(_ id: Int, offset: Double?) async throws -> String {
        let body: [String: Double?] = ["timezone": offset]
        let data = try await send("POST", "/api/devices/\(id)/timezone", json: JSONEncoder().encode(body))
        struct Result: Decodable { let delivered: String }
        let delivered = (try? JSONDecoder().decode(Result.self, from: data))?.delivered
        return delivered == "mqtt" ? "Sent to the device." : "Saved. It applies on the device's next check-in."
    }

    // MARK: Litter automation

    /// `GET /api/devices/{id}/litter-automation` (R0), asked of any device.
    func litterAutomation(_ id: Int) async throws -> LitterAutomationRecord {
        try await get("/api/devices/\(id)/litter-automation")
    }

    /// `POST /api/devices/{id}/force-continue` (R3, no body). A failed guard
    /// throws 409 with the guard's reason as the code and its sentence; a
    /// command that could not be sent throws 503 (code `unavailable`, as for
    /// every 5xx) with its sentence. Both are shown as the server words them.
    /// Resolves to the sentence for the person who pressed the button.
    func forceContinue(_ id: Int) async throws -> String {
        let data = try await send("POST", "/api/devices/\(id)/force-continue")
        struct Result: Decodable { let delivered: String }
        return DeliveryText.command((try? JSONDecoder().decode(Result.self, from: data))?.delivered ?? "unknown")
    }

    /// `PUT /api/devices/{id}/auto-pack` (R1) with the whole rule.
    func setAutoPack(_ id: Int, rule: AutoPackRule) async throws -> AutoPackResult {
        let data = try await send("PUT", "/api/devices/\(id)/auto-pack", json: JSONEncoder().encode(rule))
        return try JSONDecoder().decode(AutoPackResult.self, from: data)
    }

    // MARK: Transport

    private func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        let data = try await send("GET", path, query: query)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func send(_ method: String, _ path: String, query: [URLQueryItem] = [],
                      json: Data? = nil) async throws -> Data {
        guard let base = session.url(forPath: path),
              var parts = URLComponents(url: base, resolvingAgainstBaseURL: true)
        else { throw URLError(.badURL) }
        if !query.isEmpty { parts.queryItems = query }
        guard let url = parts.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(session.paired.token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let json {
            request.httpBody = json
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else {
            throw Self.refusal(status: http.statusCode, data: data)
        }
        return data
    }

    /// The `{"error": {"code", "message"}}` envelope as an `APIError`.
    nonisolated static func refusal(status: Int, data: Data) -> APIError {
        struct Envelope: Decodable {
            struct Inner: Decodable { let code: String; let message: String }
            let error: Inner
        }
        if let envelope = try? JSONDecoder().decode(Envelope.self, from: data) {
            return APIError(status: status, code: envelope.error.code, message: envelope.error.message)
        }
        let words = HTTPURLResponse.localizedString(forStatusCode: status).capitalized
        return APIError(status: status, code: "http_\(status)", message: words)
    }

    /// The YYYY-MM-DD before `date` (calendar arithmetic only, no zone involved).
    nonisolated static func previousDay(_ date: String) -> String? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        guard let day = formatter.date(from: date),
              let before = calendar.date(byAdding: .day, value: -1, to: day) else { return nil }
        return formatter.string(from: before)
    }
}
