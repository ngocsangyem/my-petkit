import Foundation

/// What the force-continue sheet checks before it lets the drum turn again.
/// The three rows are ticked from the server's blockers: a row is clear when
/// none of its reasons is among them. There is no live weight reading, so no
/// row carries a value; a refused row shows the server's sentence instead.
enum ForceContinueRules {
    struct Row: Equatable, Identifiable {
        let title: String
        /// The first blocker's sentence when the row is refused, else nil.
        let refusal: String?

        var id: String { title }
        var isClear: Bool { refusal == nil }
    }

    /// The checklist rows and the reasons each one covers.
    static var checks: [(title: String, reasons: Set<String>)] {
        [
            (L10n.string("No pet in the box"), ["pet_in_box", "pet_entered", "presence_unknown"]),
            (L10n.string("No visit in progress"), ["visit_open", "history_unavailable"]),
            (L10n.string("Lid closed, no fault"), ["cover_open", "device_fault"]),
        ]
    }

    static var question: String { L10n.string("Continue cleaning now?") }
    static var detail: String {
        L10n.string("The drum turns again. The box paused because it saw a cat near the entrance.")
    }
    static var warning: String {
        L10n.string("""
            Look at the box before you continue. If a cat steps inside, the box stops again \
            on its own; this app never overrides that.
            """)
    }
    static var footnote: String {
        L10n.string("Asks for your password first. Refused while a cat is inside or the lid is open.")
    }
    static var stepUpPurpose: String {
        L10n.string("Continuing a paused clean turns the drum again while a cat may be near.")
    }

    /// Whether the hero offers "Continue cleaning": only when the server says
    /// every guard passes. A box that is paused but refused shows nothing.
    static func isOffered(_ automation: LitterAutomationRecord?) -> Bool {
        guard let force = automation?.forceContinue else { return false }
        return force.supported && force.offered
    }

    static func rows(_ blockers: [ForceContinueBlocker]) -> [Row] {
        checks.map { check in
            Row(title: check.title, refusal: blockers.first { check.reasons.contains($0.reason) }?.message)
        }
    }

    /// The box is not live enough to trust its guards; refused with the
    /// server's sentence under the checklist, like any reason no row covers.
    static let notLiveReasons: Set<String> = ["device_offline", "not_on_mqtt", "state_stale"]

    /// Sentences of the blockers no row covers (not live, not paused, an
    /// unknown pause), shown under the checklist; "not live" comes first,
    /// because nothing else the box reports can be trusted until it is.
    static func otherRefusals(_ blockers: [ForceContinueBlocker]) -> [String] {
        let covered = checks.reduce(into: Set<String>()) { $0.formUnion($1.reasons) }
        let other = blockers.filter { !covered.contains($0.reason) }
        let notLive = other.filter { notLiveReasons.contains($0.reason) }
        return (notLive + other.filter { !notLiveReasons.contains($0.reason) }).map(\.message)
    }
}
