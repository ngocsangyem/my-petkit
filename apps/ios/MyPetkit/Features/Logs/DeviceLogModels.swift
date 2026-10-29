import Foundation
import PetkitCore

/// One device-uploaded log file from `/api/devicelogs`.
struct DeviceLogFileRef: Hashable, Identifiable {
    let rel: String
    let name: String
    let device: Int?
    let size: Int
    let modified: Date
    var id: String { rel }
}

/// One window of `/api/devicelogs/{path}`: `[line number, text]` pairs plus
/// counts. Decoded by hand because the route answers JSON or a raw file
/// depending on the query, and the pairs are heterogeneous arrays.
struct DeviceLogWindow: Decodable, Equatable {
    struct Line: Equatable, Identifiable {
        let number: Int
        let text: String
        var id: Int { number }
    }

    let lines: [Line]
    let total: Int
    let matched: Int
    let offset: Int
    let limit: Int

    enum CodingKeys: String, CodingKey { case lines, total, matched, offset, limit }

    init(lines: [Line], total: Int, matched: Int, offset: Int, limit: Int) {
        self.lines = lines
        self.total = total
        self.matched = matched
        self.offset = offset
        self.limit = limit
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let pairs = try container.decode([[JSONValue]].self, forKey: .lines)
        // A malformed pair is skipped instead of failing the whole window.
        lines = pairs.compactMap { pair in
            guard pair.count == 2, let number = pair[0].number, case .string(let text) = pair[1] else { return nil }
            return Line(number: Int(number), text: text)
        }
        total = try container.decodeIfPresent(Int.self, forKey: .total) ?? lines.count
        matched = try container.decodeIfPresent(Int.self, forKey: .matched) ?? lines.count
        offset = try container.decodeIfPresent(Int.self, forKey: .offset) ?? 0
        limit = try container.decodeIfPresent(Int.self, forKey: .limit) ?? lines.count
    }

    var hasEarlier: Bool { offset > 0 }
    var hasLater: Bool { offset + lines.count < matched }
}

enum DeviceLogRules {
    /// Lines per window, the server's own default.
    static let pageSize = 500

    /// Why the listing is empty, in one sentence (`reason` is a machine token).
    static func emptyReason(reason: String, enabledDevices: Int) -> String {
        switch reason {
        case "": enabledDevices > 0
            ? "Collection is on. The device uploads on its own schedule; a reboot is the usual trigger."
            : "No device has debug log collection turned on. Turn it on from the device's settings."
        case "no_log_root": "Cannot collect: no log directory is configured."
        case "no_bucket_endpoint":
            "Cannot collect: this server has no bucket address, so there is nowhere to send the device."
        case "authority_not_splittable":
            "Cannot collect: the bucket address needs a dotted name or IP the device can build."
        default: "Cannot collect: \(reason)."
        }
    }

    /// The path segments under the device log root, empty ones dropped so a
    /// stray `//` or a leading `/` never changes the route.
    static func segments(of rel: String) -> [String] {
        rel.split(separator: "/").map(String.init).filter { $0 != "." && $0 != ".." }
    }
}
