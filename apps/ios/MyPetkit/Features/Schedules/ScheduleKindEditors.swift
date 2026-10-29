import PetkitCore
import SwiftUI

/// Which row an edit sheet is open for; nil indexes add a new row.
enum ScheduleEditing: Identifiable, Equatable {
    case range(index: Int?)
    case weekly(index: Int?)
    case point(index: Int?, type: Int)
    case meal(group: Int, index: Int?)
    case oneOff

    var id: String {
        switch self {
        case .range(let index): "range-\(index ?? -1)"
        case .weekly(let index): "weekly-\(index ?? -1)"
        case .point(let index, let type): "point-\(index ?? -1)-\(type)"
        case .meal(let group, let index): "meal-\(group)-\(index ?? -1)"
        case .oneOff: "one-off"
        }
    }
}

/// The same sentence for every empty period list: unset means unrestricted.
private let unsetSentence = "Nothing here restricts the device. Add a period to change that."

/// A list of periods, each "all day" or two clocks that may cross midnight.
struct RangeListEditor: View {
    let ranges: [ScheduleRange]
    let onEdit: (ScheduleEditing) -> Void

    var body: some View {
        if ranges.isEmpty {
            Card {
                EmptyBlock(title: "Not set", message: unsetSentence, actionTitle: "Add a period") {
                    onEdit(.range(index: nil))
                }
            }
        } else {
            Card(padding: 4) {
                VStack(spacing: 0) {
                    ForEach(Array(ranges.enumerated()), id: \.offset) { index, range in
                        if index > 0 { RowRule() }
                        ScheduleRow(title: range.label, detail: "Period \(index + 1)",
                                    note: range.crossesMidnight ? "next day" : nil) {
                            onEdit(.range(index: index))
                        }
                    }
                }
                .padding(.horizontal, 12)
            }
            AddRowButton(title: "Add a period") { onEdit(.range(index: nil)) }
        }
    }
}

/// Weekly entries: each has a switch, weekdays and periods.
struct WeeklyEditor: View {
    let entries: [WeeklyEntry]
    let onEdit: (ScheduleEditing) -> Void
    let onToggle: (Int, Bool) -> Void

    var body: some View {
        if entries.isEmpty {
            Card {
                EmptyBlock(title: "Not set", message: unsetSentence, actionTitle: "Add an entry") {
                    onEdit(.weekly(index: nil))
                }
            }
        } else {
            ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                Card {
                    Toggle(isOn: Binding(get: { entry.enabled }, set: { onToggle(index, $0) })) {
                        Text(entry.days.summary).font(Theme.Font.bodyMedium)
                    }
                    .tint(Theme.Color.text)
                    RowRule()
                    ScheduleRow(title: entry.ranges.isEmpty ? "No periods" : entry.ranges.map(\.label).joined(separator: ", "),
                                detail: entry.enabled ? "On" : "Off") {
                        onEdit(.weekly(index: index))
                    }
                }
            }
            AddRowButton(title: "Add an entry") { onEdit(.weekly(index: nil)) }
        }
    }
}

/// The litter box's timed jobs, grouped by job. Both jobs share one array, so
/// each section edits its own rows and the save sends the whole array.
struct PointsEditor: View {
    let points: [PointEntry]
    let onEdit: (ScheduleEditing) -> Void

    var body: some View {
        let known = Set(ScheduleDraft.pointSections.map(\.type))
        ForEach(ScheduleDraft.pointSections, id: \.type) { section in
            sectionCard(name: section.name, type: section.type,
                    rows: points.enumerated().filter { $0.element.type == section.type })
        }
        // A type nobody has seen is kept and shown, never deleted for being odd.
        let others = points.enumerated().filter { !known.contains($0.element.type) }
        if !others.isEmpty { sectionCard(name: "Other", type: nil, rows: others) }
    }

    private func sectionCard(name: String, type: Int?, rows: [EnumeratedSequence<[PointEntry]>.Element]) -> some View {
        Card {
            Text(name).font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            if rows.isEmpty {
                Text("No times set.").font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
            }
            ForEach(rows, id: \.element.id) { index, point in
                ScheduleRow(title: ScheduleClock.format(minute: point.minute).isEmpty ? "—" : ScheduleClock.format(minute: point.minute),
                            detail: point.days.summary, note: type == nil ? "type \(point.type)" : nil) {
                    onEdit(.point(index: index, type: point.type))
                }
            }
            if let type {
                Button {
                    onEdit(.point(index: nil, type: type))
                } label: {
                    Label("Add a time", systemImage: "plus")
                }
                .buttonStyle(.secondary)
                .accessibilityLabel("Add a time: \(name)")
            }
        }
    }
}

#Preview("Range and point editors") {
    ScrollView {
        VStack(spacing: 12) {
            RangeListEditor(ranges: [ScheduleRange(start: 1320, end: 420), .allDay]) { _ in }
            WeeklyEditor(entries: SchedulesFixtures.weekly, onEdit: { _ in }, onToggle: { _, _ in })
            PointsEditor(points: SchedulesFixtures.points) { _ in }
        }
        .padding()
    }
    .background(Theme.Color.ground)
}
