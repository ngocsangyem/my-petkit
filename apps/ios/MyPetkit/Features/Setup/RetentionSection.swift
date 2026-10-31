import PetkitAPI
import PetkitCore
import SwiftUI

/// "Keep": the age and size caps per kind of record. The API reports space
/// used only for device logs, so that is the one figure shown.
struct RetentionSection: View {
    let model: ServerSetupModel
    @Binding var editing: RetentionKind?

    var body: some View {
        SectionHeader(title: L10n.string("Keep")) {
            if let bytes = model.deviceLogBytes {
                Text("Device logs use \(ByteSize.format(bytes))").font(Theme.Font.small).monospacedDigit()
                    .foregroundStyle(Theme.Color.muted)
            }
        }
        .accessibilityAddTraits(.isHeader)
        LoadableBlock(state: model.retention, loadingHeight: 200, retry: { Task { await model.loadRetention() } }, content: { caps in
            RowsCard {
                ForEach(Array(RetentionRules.kinds.enumerated()), id: \.element.id) { index, kind in
                    if index > 0 { RowRule() }
                    Button { editing = kind } label: {
                        let cap = caps.cap(for: kind.key)
                        SettingsRow(title: kind.label,
                                    value: RetentionRules.text(days: cap?.maxDays, megabytes: kind.isSized ? cap?.maxMb : nil))
                    }
                    .buttonStyle(.plain)
                }
            }
        })
    }
}

/// Edits one kind's caps. Retention is R1, so it saves from the sheet.
struct RetentionEditSheet: View {
    @Environment(\.dismiss) private var dismiss
    let kind: RetentionKind
    let save: (Double?, Double?) async -> String?
    @State private var days: String
    @State private var megabytes: String
    @State private var busy = false
    @State private var error: String?

    init(kind: RetentionKind, cap: Components.Schemas.SetupRetentionCap?,
         save: @escaping (Double?, Double?) async -> String?) {
        self.kind = kind
        self.save = save
        _days = State(initialValue: RetentionRules.fieldText(cap?.maxDays))
        _megabytes = State(initialValue: RetentionRules.fieldText(cap?.maxMb))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Keep \(kind.label.lowercased())").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            Text("The oldest go first when either cap is reached. Leave a field empty for no cap.")
                .font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
                .fixedSize(horizontal: false, vertical: true)
            LabeledField(label: L10n.string("Days"), footnote: L10n.string("Default \(RetentionRules.daysText(kind.defaultDays))")) {
                TextField("No limit", text: $days).keyboardType(.decimalPad).monospacedDigit()
            }
            if let defaultMegabytes = kind.defaultMegabytes {
                LabeledField(label: L10n.string("Size in MB"),
                             footnote: L10n.string("Default \(ByteSize.format(megabytes: defaultMegabytes))")) {
                    TextField("No limit", text: $megabytes).keyboardType(.decimalPad).monospacedDigit()
                }
            }
            if let error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
            }
            Button {
                Task { await submit() }
            } label: {
                if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Save") }
            }
            .buttonStyle(.primary)
            .disabled(busy)
            Button("Use the defaults") {
                days = RetentionRules.fieldText(kind.defaultDays)
                megabytes = RetentionRules.fieldText(kind.defaultMegabytes)
            }
            .font(Theme.Font.button)
            .foregroundStyle(Theme.Color.text)
            .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
    }

    private func submit() async {
        guard let dayCap = RetentionRules.parseCap(days) else {
            error = L10n.string("Days must be a positive number, or empty for no limit.")
            return
        }
        guard let sizeCap = kind.isSized ? RetentionRules.parseCap(megabytes) : .some(nil) else {
            error = L10n.string("The size must be a positive number of megabytes, or empty for no limit.")
            return
        }
        busy = true
        error = nil
        defer { busy = false }
        if let refusal = await save(dayCap, sizeCap) {
            error = refusal
        } else {
            dismiss()
        }
    }
}

/// Edits one text setting. It only returns the value: the write needs a
/// step-up, which the screen runs once the sheet has closed.
struct TextSettingSheet: View {
    @Environment(\.dismiss) private var dismiss
    let setting: TextSetting
    let presets: [String]
    let done: (String) -> Void
    @State private var text: String
    @State private var error: String?

    init(setting: TextSetting, initial: String, presets: [String], done: @escaping (String) -> Void) {
        self.setting = setting
        self.presets = presets
        self.done = done
        _text = State(initialValue: initial)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(setting.title).font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            LabeledField(label: L10n.string("Value"), footnote: setting.footnote) {
                TextField("Empty", text: $text)
                    .font(Theme.Font.mono)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(setting == .dns ? .numbersAndPunctuation : .URL)
            }
            if let error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
            }
            Button("Save") { submit() }.buttonStyle(.primary)
            Text("Saving asks for your password.").font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
    }

    private func submit() {
        switch setting {
        case .dns where !SetupRules.isValidDNS(text):
            error = L10n.string("The resolver must be an IPv4 address, optionally with a port.")
        case .upstream where !SetupRules.isValidUpstream(text, presets: presets):
            error = L10n.string("The upstream must be a region preset or an http(s) URL.")
        default:
            done(text)
            dismiss()
        }
    }
}
