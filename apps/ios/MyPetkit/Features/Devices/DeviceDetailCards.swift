import PetkitCore
import SwiftUI

/// A device's sessions of its own today, newest first, and its visit count.
struct DeviceToday {
    struct Row: Identifiable {
        let id: Int
        let minute: Double
        let title: String
        let detail: String?
        let isFeeding: Bool
    }

    let rows: [Row]
    let visits: Int

    init(sessions: [TimelineSessionRecord], zone: TimeZone?, now: Date) {
        guard let zone else {
            rows = []
            visits = 0
            return
        }
        let today = sessions.compactMap { session -> (TimelineSessionRecord, Date)? in
            guard let date = session.date, DayStripLayout.isSameDay(date, now, in: zone) else { return nil }
            return (session, date)
        }
        visits = today.filter { $0.0.isVisit }.count
        rows = today.sorted { $0.1 > $1.1 }.enumerated().map { index, entry in
            let (session, date) = entry
            let minute = DayStripLayout.minuteOfDay(date, in: zone)
            let duration = session.durationSec.flatMap { $0 > 0 ? DeviceFindings.duration($0) : nil }
            return Row(id: index, minute: minute, title: Self.title(session),
                       detail: [DayStripLayout.clock(minute: minute), duration].compactMap { $0 }.joined(separator: " · "),
                       isFeeding: session.eventKind == "feeding")
        }
    }

    static func title(_ session: TimelineSessionRecord) -> String {
        let pet = session.petName ?? "A cat"
        if session.isVisit { return session.eventKind == "drinking" ? "\(pet) drank" : "\(pet) visited" }
        if session.eventKind == "feeding" { return "Fed" }
        return session.label ?? session.eventKind?.capitalized ?? "Event"
    }

    /// Whether a planned meal was fed: a feeding within an hour after its time
    /// (or a few minutes before, for a clock that runs fast).
    func fed(_ meal: PlannedMeal) -> Bool {
        rows.contains { $0.isFeeding && $0.minute >= meal.minute - 5 && $0.minute <= meal.minute + 60 }
    }
}

/// "Today" on a detail: a feeder's planned and fed meals, or what the device
/// saw today, with a link to its schedule when it has one.
struct DeviceTodayCard: View {
    let device: DeviceRecord
    let sessions: Loadable<[TimelineSessionRecord]>
    let today: DeviceToday
    let meals: [PlannedMeal]
    let zone: TimeZone?
    let now: Date
    let retry: () -> Void

    static let rowLimit = 6

    var body: some View {
        SectionHeader(title: "Today") {
            if !device.schedules.isEmpty {
                NavigationLink("Schedule") { SchedulesView(deviceID: String(device.id)) }
                    .font(Theme.Font.control.weight(.semibold)).foregroundStyle(Theme.Color.accent)
            }
        }
        Card(padding: 0) {
            Group {
                switch sessions {
                case .loading: LoadingBars(lines: 0, height: 52).padding(.vertical, 12)
                case .failed(let message): BlockError(message: message, retry: retry).padding(.vertical, 12)
                case .loaded:
                    if DeviceFamily(deviceType: device.type) == .feeder && !meals.isEmpty {
                        mealRows
                    } else if today.rows.isEmpty {
                        Text("Nothing yet today.").font(Theme.Font.body).foregroundStyle(Theme.Color.muted)
                            .frame(maxWidth: .infinity, minHeight: Theme.Space.rowHeight, alignment: .leading)
                    } else {
                        sessionRows
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private var sessionRows: some View {
        VStack(spacing: 0) {
            ForEach(today.rows.prefix(Self.rowLimit)) { row in
                if row.id > 0 { RowRule() }
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.title).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                    if let detail = row.detail {
                        Text(detail).font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
            }
        }
    }

    private var mealRows: some View {
        let nowMinute = zone.map { DayStripLayout.minuteOfDay(now, in: $0) } ?? 0
        let next = FeedPlan.next(meals, after: nowMinute)
        let dual = FeedPlan.isDual(device.schedules)
        return VStack(spacing: 0) {
            ForEach(Array(meals.enumerated()), id: \.offset) { index, meal in
                if index > 0 { RowRule() }
                HStack(spacing: 12) {
                    Text(DayStripLayout.clock(minute: meal.minute)).font(Theme.Font.section).monospacedDigit()
                        .frame(width: 56, alignment: .leading)
                    Text(meal.portionsText(dual: dual)).font(Theme.Font.body).frame(maxWidth: .infinity, alignment: .leading)
                    if today.fed(meal) {
                        Pill(text: "Fed", tone: .positive)
                    } else if meal == next {
                        Text("In \(DeviceFindings.duration((meal.minute - nowMinute) * 60))")
                            .font(Theme.Font.smallMedium).monospacedDigit().foregroundStyle(Theme.Color.accent)
                    } else {
                        Text(meal.minute > nowMinute ? "Planned" : "No feed recorded")
                            .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                    }
                }
                .frame(minHeight: Theme.Space.rowHeight)
            }
        }
    }
}

/// Days-left consumables, each with a bar at its true share of a fresh one.
struct ConsumablesCard: View {
    let rows: [ConsumableRow]

    var body: some View {
        if !rows.isEmpty {
            SectionHeader("Consumables")
            Card {
                ForEach(rows) { row in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(row.label).font(Theme.Font.body)
                            Spacer()
                            Text(DeviceFindings.daysText(row.days)).monospacedDigit()
                                .font(row.isLow ? Theme.Font.bodyMedium.weight(.semibold) : Theme.Font.body)
                                .foregroundStyle(row.isLow ? Theme.Color.warning : Theme.Color.text)
                        }
                        RatioBar(ratio: row.ratio, label: "", tint: row.isLow ? Theme.Color.warning : Theme.Color.accent)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }
}

/// On-device AI: recognition on or off, then what the camera watches for.
struct AICard: View {
    let enabled: Loadable<Bool>
    let entities: [DeviceEntity]
    let deviceOnline: Bool
    let setAI: (Bool) -> Void
    let ask: (DeviceEntity, EntityWrite) -> Void
    let retry: () -> Void

    var body: some View {
        SectionHeader("On-device AI")
        Card(padding: 0) {
            VStack(spacing: 0) {
                LoadableBlock(state: enabled, loadingHeight: 36, retry: retry) { on in
                    Toggle(isOn: Binding(get: { on }, set: setAI)) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Recognise pets").font(Theme.Font.body)
                            Text("Matches each visit to a cat by its face.")
                                .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                        }
                    }
                    .tint(Theme.Color.text)
                    .frame(minHeight: Theme.Space.rowHeight)
                }
                .padding(.vertical, enabled.value == nil ? 12 : 0)
                if !entities.isEmpty {
                    RowRule()
                    EntityRows(entities: entities, enabled: deviceOnline, ask: ask)
                }
            }
            .padding(.horizontal, 16)
        }
    }
}

/// A camera's media upload switches: off stops that upload at the source.
struct CapabilitiesCard: View {
    let capabilities: Loadable<DeviceDetailModel.Capabilities>
    let set: (CapabilityFlag, Bool) -> Void
    let retry: () -> Void

    var body: some View {
        SectionHeader("Media uploads")
        Card(padding: 0) {
            LoadableBlock(state: capabilities, loadingHeight: 120, retry: retry) { flags in
                VStack(spacing: 0) {
                    ForEach(Array(CapabilityFlag.allCases.enumerated()), id: \.element) { index, flag in
                        if index > 0 { RowRule() }
                        Toggle(flag.label, isOn: Binding(get: { flag.isOn(flags) }, set: { set(flag, $0) }))
                            .font(Theme.Font.body)
                            .tint(Theme.Color.text)
                            .frame(minHeight: Theme.Space.rowHeight)
                    }
                    Text("Takes effect when the device next asks for upload credentials.")
                        .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.bottom, 12)
                }
            }
            .padding(.horizontal, 16)
        }
    }
}
