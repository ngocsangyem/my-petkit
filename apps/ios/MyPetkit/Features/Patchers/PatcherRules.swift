import Foundation

/// Apply or remove: what the final button on a patcher screen does.
enum PatcherAction: String, Equatable {
    case apply
    case remove
}

/// A patcher's state as one word and its tone.
struct PatcherStatusWord: Equatable {
    enum Tone: Equatable { case positive, warning, neutral }
    let text: String
    let tone: Tone
}

/// The rules of the patcher screens that need no UI: progress lines from
/// `patcher` live events, status words, which action applies, and what can
/// block it.
enum PatcherRules {
    /// Every `patcher` event summary starts with `[patcher_id]`.
    static func patcherID(fromSummary summary: String) -> String? {
        guard summary.hasPrefix("["), let close = summary.firstIndex(of: "]") else { return nil }
        let id = summary[summary.index(after: summary.startIndex)..<close]
        guard !id.isEmpty, id.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" }) else { return nil }
        return String(id)
    }

    /// A line that ends a run: `done` and `FAILED`, plus the other two last
    /// lines the server writes, so a removal also refreshes the status.
    static func isFinalLine(_ summary: String) -> Bool {
        ["done", "FAILED", "removal queued", "cancelled"].contains { summary.contains($0) }
    }

    /// A failed run's last line, so it can be shown in red.
    static func isFailure(_ summary: String) -> Bool {
        summary.contains("FAILED")
    }

    /// Descriptions hold real newlines and, in places, the two characters
    /// `\n`; both become line breaks.
    static func normaliseDescription(_ text: String) -> String {
        text.replacingOccurrences(of: "\\n", with: "\n")
    }

    /// The first paragraph, for the lede and the list row.
    static func firstParagraph(_ text: String) -> String {
        let normalised = normaliseDescription(text)
        let paragraphs = normalised.components(separatedBy: "\n\n")
        return (paragraphs.first ?? normalised).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Everything after the first paragraph (which is already the lede), or
    /// the whole text when it is a single paragraph.
    static func detailParagraphs(_ text: String) -> String {
        let paragraphs = normaliseDescription(text).components(separatedBy: "\n\n")
        guard paragraphs.count > 1 else { return normaliseDescription(text).trimmingCharacters(in: .whitespacesAndNewlines) }
        return paragraphs.dropFirst().joined(separator: "\n\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func status(applied: Bool, greyed: Bool, unavailable: String) -> PatcherStatusWord {
        if !unavailable.isEmpty { return PatcherStatusWord(text: unavailable, tone: .warning) }
        if greyed { return PatcherStatusWord(text: "Active · MQTT connected", tone: .positive) }
        if applied { return PatcherStatusWord(text: "Applied", tone: .positive) }
        return PatcherStatusWord(text: "Not applied", tone: .neutral)
    }

    /// Remove what is in place, apply what is not.
    static func primaryAction(applied: Bool, greyed: Bool) -> PatcherAction {
        applied || greyed ? .remove : .apply
    }

    /// Why Apply cannot run right now, or nil. The server is the final word;
    /// this only saves a step-up that would certainly be refused.
    static func applyBlocker(greyed: Bool, deviceIP: String) -> String? {
        if greyed {
            return "The device already holds an MQTT session, which proves this patch is in place."
        }
        if deviceIP.isEmpty {
            return "The server does not know the device's address yet. Wait for it to send a state report."
        }
        return nil
    }

    /// The key formats the server accepts for the ssh patcher.
    static func isValidPublicKey(_ key: String) -> Bool {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        return ["ssh-rsa ", "ecdsa-sha2-", "ssh-ed25519 "].contains { trimmed.hasPrefix($0) }
            && !trimmed.contains("\n")
    }

    static func undoText(for action: PatcherAction) -> String {
        switch action {
        case .apply:
            "Remove undoes it: the patch files are deleted and the box reboots. With no patch left it boots stock firmware."
        case .remove:
            "The box reboots without this patch. Other patches stay active; apply it again at any time."
        }
    }
}
