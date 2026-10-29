import Foundation

/// Any JSON value, for fields whose shape varies (an event's `detail`, a
/// device's raw state). Rendered as text only, never interpreted as markup.
public enum JSONValue: Sendable, Hashable, Codable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: JSONValue].self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }

    public subscript(key: String) -> JSONValue? {
        if case .object(let object) = self { return object[key] }
        return nil
    }

    public var string: String? {
        switch self {
        case .string(let value): value
        case .number(let value):
            if value.rounded() == value, abs(value) < 1e15 { String(Int64(value)) } else { String(value) }
        case .bool(let value): String(value)
        default: nil
        }
    }

    public var number: Double? {
        switch self {
        case .number(let value): value
        case .string(let value): Double(value)
        case .bool(let value): value ? 1 : 0
        default: nil
        }
    }
}
