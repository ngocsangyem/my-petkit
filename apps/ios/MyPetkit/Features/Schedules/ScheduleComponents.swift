import PetkitCore
import SwiftUI

/// The header of a screen pushed from a device: back and one action in the
/// bar, then the title and one line of lede.
struct ScheduleScreenHeader: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    var lede: Text?
    var actionImage: String?
    var actionLabel = ""
    var action: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                IconButton(systemImage: "chevron.left", label: L10n.string("Back")) { dismiss() }
                Spacer()
                if let actionImage, let action {
                    IconButton(systemImage: actionImage, label: actionLabel, action: action)
                }
            }
            .frame(minHeight: Theme.Space.control)
            Text(title).font(Theme.Font.title).foregroundStyle(Theme.Color.text)
                .accessibilityAddTraits(.isHeader)
            if let lede {
                lede.font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, Theme.Space.headerEdge)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Seven round day toggles, Monday first; the wire keeps Sunday as day 1.
struct WeekdayPicker: View {
    @Binding var days: WeekdaySet

    var body: some View {
        HStack(spacing: 6) {
            ForEach(WeekdaySet.displayOrder, id: \.self) { day in
                let isOn = days.contains(.day(day))
                Button {
                    days.toggle(day)
                } label: {
                    Text(String(WeekdaySet.shortNames[day - 1].prefix(2)))
                        .font(Theme.Font.smallMedium)
                        .foregroundStyle(isOn ? Theme.Color.onPrimary : Theme.Color.text)
                        .frame(maxWidth: .infinity, minHeight: Theme.Space.chip)
                        .background(isOn ? Theme.Color.text : Theme.Color.raised, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(weekdayNames[day - 1])
                .accessibilityAddTraits(isOn ? .isSelected : [])
            }
        }
    }

    /// Full weekday names in the app language, Sunday first like the wire.
    private var weekdayNames: [String] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = L10n.locale
        return calendar.weekdaySymbols
    }
}

/// A time typed as "HH:MM". The text is the source of truth: clearing it
/// leaves it empty, and the sheet says so instead of restoring the old time.
struct ClockField: View {
    let label: String
    @Binding var text: String
    var allowsEndOfDay = false

    var body: some View {
        LabeledField(label: label) {
            TextField("HH:MM", text: $text)
                .keyboardType(.numbersAndPunctuation)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .monospacedDigit()
                .foregroundStyle(isValid ? Theme.Color.text : Theme.Color.negative)
                .accessibilityLabel(label)
        }
    }

    private var isValid: Bool {
        text.isEmpty || ScheduleClock.parse(text, allowsEndOfDay: allowsEndOfDay) != nil
    }
}

/// A whole-number portion count, held as typed for the same reason.
struct PortionField: View {
    let label: String
    @Binding var text: String
    let max: Int

    var body: some View {
        LabeledField(label: label, footnote: L10n.string("0 to \(max)")) {
            TextField("0", text: $text)
                .keyboardType(.numberPad)
                .monospacedDigit()
                .foregroundStyle(text.isEmpty || PortionRules.parse(text, max: max) != nil
                                 ? Theme.Color.text : Theme.Color.negative)
                .accessibilityLabel(label)
        }
    }
}

/// The frame every edit sheet shares: fields, the one problem, Done, and
/// Remove for an existing row. Done stays disabled while there is a problem.
struct ScheduleSheetFrame<Fields: View>: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let problem: String?
    /// Done unless the sheet names its own action.
    var doneTitle: String?
    var dismissesOnDone = true
    var onRemove: (() -> Void)?
    let onDone: () -> Void
    @ViewBuilder var fields: Fields

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(title).font(Theme.Font.section).accessibilityAddTraits(.isHeader)
                fields
                if let problem {
                    Text(problem).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Button(doneTitle ?? L10n.string("Done")) {
                    onDone()
                    if dismissesOnDone { dismiss() }
                }
                .buttonStyle(.primary)
                .disabled(problem != nil)
                if let onRemove {
                    Button("Remove") {
                        onRemove()
                        dismiss()
                    }
                    .font(Theme.Font.button)
                    .foregroundStyle(Theme.Color.negative)
                    .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
                }
                Button("Cancel") { dismiss() }
                    .font(Theme.Font.button)
                    .foregroundStyle(Theme.Color.text)
                    .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
            }
            .padding(.horizontal, 20)
            .padding(.top, 24)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
    }
}

/// A full-width white pill with a leading plus, as "Add a meal".
struct AddRowButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: "plus")
        }
        .buttonStyle(SecondaryButtonStyle(fill: Theme.Color.surface))
    }
}

/// A tappable row inside a card: value at the left, optional note, chevron.
struct ScheduleRow: View {
    let title: String
    var detail: String?
    var note: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(Theme.Font.bodyMedium).monospacedDigit().foregroundStyle(Theme.Color.text)
                    if let detail {
                        Text(detail).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                    }
                }
                Spacer(minLength: 8)
                if let note { Pill(text: note) }
                Image(systemName: "chevron.right").font(Theme.Font.chevron)
                    .foregroundStyle(Theme.Color.muted).accessibilityHidden(true)
            }
            .frame(minHeight: Theme.Space.rowHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Edit")
    }
}

#Preview("Schedule components") {
    @Previewable @State var days = WeekdaySet.weekdays
    @Previewable @State var time = ""
    VStack(spacing: 12) {
        WeekdayPicker(days: $days)
        ClockField(label: "Time", text: $time)
        Card {
            ScheduleRow(title: "22:00 – 07:00", detail: "Every day", note: "next day") {}
        }
        AddRowButton(title: "Add a meal") {}
    }
    .padding()
    .background(Theme.Color.ground)
}
