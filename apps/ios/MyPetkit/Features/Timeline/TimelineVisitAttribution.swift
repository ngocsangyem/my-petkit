import PetkitCore
import SwiftUI

/// A card's meta line, with the "by weight" tag when a visit was matched by
/// weight rather than recognised by the camera.
struct TimelineMetaLine: View {
    let entry: TimelineEntry
    let tzOffset: Int

    var body: some View {
        HStack(spacing: 6) {
            Text(TimelineFormat.metaLine(entry, tzOffset: tzOffset)).font(Theme.Font.small)
                .monospacedDigit().foregroundStyle(Theme.Color.muted)
            if entry.isMatchedByWeight {
                Pill(text: L10n.string("by weight"), isCompact: true)
            }
        }
    }
}

/// "Change cat" on a visit card's long press; events have no cat to change.
struct TimelineChangeCatMenu: ViewModifier {
    let entry: TimelineEntry
    let open: (TimelineAction) -> Void

    func body(content: Content) -> some View {
        if TimelineChangeCatRules.canChange(entry) {
            content.contextMenu {
                Button { open(.changeCat(entry)) } label: { Label("Change cat", systemImage: "pawprint") }
            }
        } else {
            content
        }
    }
}
