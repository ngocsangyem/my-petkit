import Foundation

/// One frame of `GET /api/ws` (packages/contracts/ws-events.md). `kind` is an
/// open set: unknown kinds are kept, and the UI ignores what it cannot show.
public struct LiveEvent: Sendable, Hashable, Decodable, Identifiable {
    public let seq: Int?
    public let ts: Double
    public let kind: String
    public let deviceID: String?
    public let summary: String
    public let detail: JSONValue?

    public var id: String { seq.map(String.init) ?? "\(kind)-\(ts)" }
    public var date: Date { Date(timeIntervalSince1970: ts) }
    public var isPing: Bool { kind == "ping" }

    enum CodingKeys: String, CodingKey {
        case seq, ts, kind, summary, detail
        case deviceID = "device_id"
    }

    public init(seq: Int?, ts: Double, kind: String, deviceID: String?, summary: String, detail: JSONValue?) {
        self.seq = seq
        self.ts = ts
        self.kind = kind
        self.deviceID = deviceID
        self.summary = summary
        self.detail = detail
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        seq = try c.decodeIfPresent(Int.self, forKey: .seq)
        ts = try c.decode(Double.self, forKey: .ts)
        kind = try c.decode(String.self, forKey: .kind)
        deviceID = try c.decodeIfPresent(JSONValue.self, forKey: .deviceID)?.string
        summary = try c.decodeIfPresent(String.self, forKey: .summary) ?? ""
        detail = try c.decodeIfPresent(JSONValue.self, forKey: .detail)
    }
}

/// Connection state of the live stream, for the "Live" dot.
public enum LiveConnection: Sendable, Equatable {
    case connecting
    case live
    case disconnected
}
