import Foundation

/// A JSON value as the schedule editors read and write it. The server serves
/// a schedule's `value` as free-form JSON whose shape depends on its kind, so
/// it is decoded into this first and parsed by plain functions that can be
/// tested without a client.
///
/// Integers stay integers: the firmware reads minutes, seconds and portions as
/// whole numbers, and `5` must not reach it as `5.0`.
enum ScheduleJSON: Codable, Equatable, Sendable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([ScheduleJSON])
    case object([String: ScheduleJSON])

    init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Int.self) {
            self = .int(value)
        } else if let value = try? container.decode(Double.self) {
            self = .double(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([ScheduleJSON].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: ScheduleJSON].self))
        }
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .int(let value): try container.encode(value)
        case .double(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }

    /// Re-reads any JSON-encodable value (such as the generated client's
    /// free-form containers) as a `ScheduleJSON`.
    static func converting(_ value: some Encodable) throws -> ScheduleJSON {
        try JSONDecoder().decode(ScheduleJSON.self, from: JSONEncoder().encode(value))
    }

    // MARK: Lenient readers, the way the server's `to_int` reads a field

    var array: [ScheduleJSON] {
        if case .array(let value) = self { return value }
        return []
    }

    var object: [String: ScheduleJSON]? {
        if case .object(let value) = self { return value }
        return nil
    }

    /// A whole number from an int, a whole double or a numeric string.
    var int: Int? {
        switch self {
        case .int(let value): return value
        case .double(let value):
            return value.rounded(.towardZero) == value && abs(value) < 1e15 ? Int(value) : nil
        case .string(let value): return Int(value.trimmingCharacters(in: .whitespaces))
        case .bool(let value): return value ? 1 : 0
        default: return nil
        }
    }

    /// Text from a string or a number, the way a weekday list may arrive.
    var text: String {
        switch self {
        case .string(let value): return value
        case .int(let value): return String(value)
        default: return ""
        }
    }

    subscript(key: String) -> ScheduleJSON {
        object?[key] ?? .null
    }
}
