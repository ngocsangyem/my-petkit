import Foundation

/// A downloaded file waiting in a private temporary folder for `ShareLink`.
/// Captures and device logs can hold secrets, so the folder is emptied when
/// the screen that made it goes away instead of waiting for the system.
struct SharedFile: Identifiable, Hashable {
    let url: URL
    var id: URL { url }

    private static var folder: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("shared-downloads", isDirectory: true)
    }

    /// Writes `data` under `name`, keeping only its last path component so a
    /// server-supplied name can never point outside the folder.
    static func write(_ data: Data, named name: String) throws -> SharedFile {
        let safeName = safeFileName(name)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent(safeName, isDirectory: false)
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        return SharedFile(url: url)
    }

    static func removeAll() {
        try? FileManager.default.removeItem(at: folder)
    }

    /// The last path component with anything outside a conservative set
    /// replaced, never empty and never a dot name.
    static func safeFileName(_ name: String) -> String {
        let last = name.split(separator: "/").last.map(String.init) ?? ""
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._-"))
        let cleaned = String(last.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" })
        let trimmed = cleaned.trimmingCharacters(in: CharacterSet(charactersIn: "."))
        return trimmed.isEmpty ? "download.txt" : trimmed
    }
}
