import Foundation
import PetkitCore

/// How capture files and their records read on screen.
enum CaptureRules {
    /// Records shown from the end of a file, as the web panel shows them.
    static let tailLimit = 60

    /// What a capture file holds, from the name the server writes it under
    /// (`utils/capture.py::capture_record` callers). Unknown names get none.
    static func describe(_ fileName: String) -> String? {
        let stem = fileName.hasSuffix(".jsonl") ? String(fileName.dropLast(6)) : fileName
        switch stem {
        case "requests": return "HTTP from devices"
        case "mqtt": return "broker frames"
        case "state_report": return "state reports"
        case "state_report_raw": return "raw state reports"
        case "event_report": return "event reports"
        case "upload_file_info": return "media upload reports"
        case "proxy_http": return "proxied HTTP with the cloud's replies"
        case "proxy_redactions": return "what proxy mode rewrote"
        case "proxy_mqtt": return "proxied MQTT frames"
        default: return nil
        }
    }

    /// One record as a single line: compact JSON with sorted keys, or the
    /// raw text when the server could not parse the line (`{"raw": line}`).
    static func lineText(_ record: JSONValue) -> String {
        if case .object(let object) = record, object.count == 1, case .string(let raw)? = object["raw"] {
            return raw
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        guard let data = try? encoder.encode(record) else { return "" }
        return String(bytes: data, encoding: .utf8) ?? ""
    }

    /// "Recording is off. 4 files on the server."
    static func summary(recording: Bool, fileCount: Int) -> String {
        let files = switch fileCount {
        case 0: "No files on the server."
        case 1: "1 file on the server."
        default: "\(fileCount) files on the server."
        }
        return "Recording is \(recording ? "on" : "off"). \(files)"
    }
}
