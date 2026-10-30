import PetkitCore
import SwiftUI

/// The T6's auto-pack rows inside "Automation" (`ios-device-t6`): the switch
/// with its Experimental tag, the trigger, its threshold, optional quiet
/// hours, PetKit's advice and what the rule last did. Turning it on asks
/// first; other edits wait for Save, which sends the whole rule.
struct AutoPackRows: View {
    let rule: AutoPackRule
    let status: AutoPackStatus?
    let zone: TimeZone?
    let now: Date
    let busy: Bool
    let error: String?
    /// Saves a rule as it is (turning off, or other edits).
    let save: (AutoPackRule) -> Void
    /// Asks before saving a rule that turns auto-pack on.
    let askEnable: (AutoPackRule) -> Void

    @State private var draft: AutoPackDraft

    init(rule: AutoPackRule, status: AutoPackStatus?, zone: TimeZone?, now: Date, busy: Bool, error: String?,
         save: @escaping (AutoPackRule) -> Void, askEnable: @escaping (AutoPackRule) -> Void) {
        self.rule = rule
        self.status = status
        self.zone = zone
        self.now = now
        self.busy = busy
        self.error = error
        self.save = save
        self.askEnable = askEnable
        _draft = State(initialValue: AutoPackDraft(rule))
    }

    private var edited: AutoPackRule { draft.rule(enabled: rule.enabled) }
    private var isDirty: Bool { edited != rule }

    var body: some View {
        VStack(spacing: 0) {
            enableRow
            RowRule()
            triggerRow
            if draft.trigger != .binFull {
                RowRule()
                thresholdRow
            }
            RowRule()
            SettingToggleRow(title: "Quiet hours", footnote: "No automatic pack inside this window.",
                             isOn: $draft.quietHours, isBusy: busy)
            if draft.quietHours {
                timeRow("From", minute: $draft.quietStart)
                timeRow("To", minute: $draft.quietEnd)
            }
            if isDirty {
                Button("Save") { save(edited) }
                    .buttonStyle(.secondary)
                    .disabled(busy)
                    .padding(.vertical, 8)
            }
            RowRule()
            footer
        }
        .onChange(of: rule) { _, saved in draft = AutoPackDraft(saved) }
    }

    /// Laid out by hand and held at its ideal height: a Toggle, or a tight
    /// height proposal, would squeeze the three-line label against its rules.
    private var enableRow: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text("Auto-pack").font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                    Pill(text: "Experimental")
                }
                Text(AutoPackText.summary(edited)).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            Toggle("Auto-pack", isOn: Binding(get: { rule.enabled }, set: { on in
                on ? askEnable(draft.rule(enabled: true)) : save(draft.rule(enabled: false))
            }))
            .labelsHidden()
            .tint(Theme.Color.text)
            .disabled(busy)
        }
        .padding(.vertical, 10)
        .frame(minHeight: Theme.Space.rowHeight)
        .fixedSize(horizontal: false, vertical: true)
    }

    private var triggerRow: some View {
        Menu {
            Picker("Pack trigger", selection: $draft.trigger) {
                ForEach(AutoPackTrigger.allCases, id: \.self) { Text(AutoPackText.option($0)).tag($0) }
            }
        } label: {
            SettingsRow(title: "Pack trigger", value: AutoPackText.trigger(edited))
        }
        .buttonStyle(.plain)
        .disabled(busy)
    }

    @ViewBuilder
    private var thresholdRow: some View {
        if draft.trigger == .afterCleanings {
            Stepper(value: $draft.cleanings, in: AutoPackRule.cleaningsRange) {
                HStack {
                    Text("Cleans before a pack").font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                    Spacer(minLength: 8)
                    Text("\(draft.cleanings)").font(Theme.Font.body).monospacedDigit().foregroundStyle(Theme.Color.muted)
                }
            }
            .disabled(busy)
            .frame(minHeight: Theme.Space.rowHeight)
        } else {
            timeRow("Pack at", minute: $draft.atMinute)
        }
    }

    /// A time of the device's day. The picker runs in UTC on purpose: the
    /// value is a wall-clock "HH:MM" for the device, not a moment for the phone.
    /// It is also pinned to 24-hour time, the way the rule's summary and
    /// status lines print it, whatever the phone's region prefers.
    private func timeRow(_ title: String, minute: Binding<Int>) -> some View {
        DatePicker(selection: Binding(
            get: { Date(timeIntervalSince1970: TimeInterval(minute.wrappedValue * 60)) },
            set: { minute.wrappedValue = Int($0.timeIntervalSince1970 / 60) % ScheduleClock.dayMinutes }
        ), displayedComponents: .hourAndMinute) {
            Text(title).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
        }
        .environment(\.timeZone, .gmt)
        .environment(\.locale, Locale(identifier: "en_GB"))
        .disabled(busy)
        .frame(minHeight: Theme.Space.rowHeight)
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let line = AutoPackText.status(status, enabled: rule.enabled, zone: zone, now: now) {
                Text(line).font(Theme.Font.small).foregroundStyle(Theme.Color.lede)
            }
            Text(AutoPackText.advice).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
            if let error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 12)
    }
}
