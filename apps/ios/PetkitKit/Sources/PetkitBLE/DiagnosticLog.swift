import Foundation
import Observation

/// The session log: what the app did, what the device said, and the raw
/// frames both ways with the write format used. It is what a user shares when
/// a device will not provision, so the frame holding the Wi-Fi password is
/// never written out — only its length.
@MainActor
@Observable
public final class DiagnosticLog {
    public struct Line: Identifiable, Equatable, Sendable {
        public let id: Int
        public let time: Date
        public let text: String
        /// Raw frames are shown in mono and kept out of the short view.
        public let isFrame: Bool
    }

    public private(set) var lines: [Line] = []
    private let clock: () -> Date

    public init(clock: @escaping () -> Date = Date.init) {
        self.clock = clock
    }

    public func note(_ text: String) {
        lines.append(Line(id: lines.count, time: clock(), text: text, isFrame: false))
    }

    public enum Direction: String, Sendable { case sent = "→", received = "←" }

    /// One raw frame. `secret` frames are logged by length alone.
    public func frame(_ direction: Direction, _ bytes: Data, format: String, secret: Bool = false) {
        let body = secret ? "(\(bytes.count) bytes, withheld: holds the Wi-Fi password)" : Self.hex(bytes)
        lines.append(Line(id: lines.count, time: clock(), text: "\(direction.rawValue) [\(format)] \(body)", isFrame: true))
    }

    public func clear() { lines.removeAll() }

    /// The whole log as text for the share sheet, with a header naming the
    /// device and the app so a report stands on its own.
    public func export(header: [String]) -> String {
        let body = lines.map { "\(Self.timeFormat.string(from: $0.time))  \($0.text)" }
        return (header + [""] + body).joined(separator: "\n") + "\n"
    }

    private static let timeFormat: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm:ss.SSS"
        return formatter
    }()

    nonisolated static func hex(_ bytes: Data) -> String {
        bytes.map { String(format: "%02X", $0) }.joined(separator: " ")
    }
}
