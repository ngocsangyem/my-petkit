import PetkitAPI
import PetkitCore
import SwiftUI

/// A device's schedule editor (`ios-schedules`), pushed from its detail: one
/// tab per schedule the server says the device has, plus one-off feeds on a
/// feeder. Edits stay on the phone until Save, which asks first.
struct SchedulesView: View {
    let deviceID: String
    @Environment(ServerSession.self) private var session: ServerSession?
    @State private var model: SchedulesModel
    @State private var editing: ScheduleEditing?
    @State private var confirmation: CommandConfirmation?
    private let loadsFromServer: Bool

    init(deviceID: String) {
        self.deviceID = deviceID
        _model = State(initialValue: SchedulesModel(deviceID: deviceID))
        loadsFromServer = true
    }

    /// A screen over a prepared model, for previews.
    init(model: SchedulesModel) {
        deviceID = model.deviceID
        _model = State(initialValue: model)
        loadsFromServer = false
    }

    var body: some View {
        // The app has its own `TimelineView` (the Timeline tab), hence the module name.
        SwiftUI.TimelineView(.everyMinute) { context in
            // A prepared model is drawn at a fixed moment, so the now line in
            // previews and snapshots does not move with the wall clock.
            let now = loadsFromServer ? context.date : DevicePreviewFixtures.now
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ScheduleScreenHeader(title: title, lede: lede(now: now),
                                       actionImage: addAction == nil ? nil : "plus",
                                       actionLabel: addLabel, action: addAction)
                    VStack(alignment: .leading, spacing: Theme.Space.gap) { content(now: now) }
                        .padding(.horizontal, Theme.Space.screenEdge)
                        .padding(.bottom, Theme.Space.pad)
                }
            }
            .refreshable { await reload() }
        }
        .background(Theme.Color.ground.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task { await reload() }
        .sheet(item: $editing) { SchedulesEditSheet(model: model, editing: $0, submitOneOff: addOneOff) }
        .background { Color.clear.sheet(item: $confirmation) { ConfirmCommandSheet(confirmation: $0) } }
    }

    // MARK: Header

    private var title: String {
        model.currentTarget?.kind == .feed || model.currentTab == SchedulesModel.oneOffTab
            ? "Feeding schedule" : "Schedules"
    }

    private func lede(now: Date) -> Text? {
        guard let device = model.device.value else { return nil }
        if let feed = model.feedTarget, let zone = model.zone.value,
           case .feed(let groups) = ScheduleDraft(kind: .feed, value: feed.value) {
            let clock = zone.clock
            let next = ScheduleFeedPlan.nextMeal(groups: groups, weekday: clock.weekday(now),
                                                 nowSecond: clock.minuteOfDay(now) * 60)
            return Text(ScheduleFeedPlan.sentence(for: next) + " \(device.name).")
        }
        return Text("\(device.name) runs these on its own clock.")
    }

    private var addLabel: String {
        switch model.currentTarget?.kind {
        case .feed: "Add a meal"
        case .ranges: "Add a period"
        case .weekly: "Add an entry"
        case .points: "Add a cleaning time"
        case nil: "Schedule a one-off feed"
        }
    }

    private var addAction: (() -> Void)? {
        guard model.device.value != nil else { return nil }
        switch model.currentTarget?.kind {
        case .feed: return { editing = .meal(group: 0, index: nil) }
        case .ranges: return { editing = .range(index: nil) }
        case .weekly: return { editing = .weekly(index: nil) }
        case .points: return { editing = .point(index: nil, type: 0) }
        case nil:
            return model.currentTab == SchedulesModel.oneOffTab && model.zone.value != nil
                ? { editing = .oneOff } : nil
        }
    }

    // MARK: Content

    @ViewBuilder
    private func content(now: Date) -> some View {
        LoadableBlock(state: model.device, retry: retryAll) { device in
            if model.tabs.isEmpty {
                Card {
                    EmptyBlock(title: "No schedules",
                               message: "\(device.name) has no schedule this server can serve.")
                }
            } else {
                SchedulesTabs(tabs: model.tabs, selection: Binding(get: { model.currentTab },
                                                                   set: { model.selectedTab = $0 }))
                if let target = model.currentTarget {
                    SchedulesTargetEditor(model: model, target: target, now: feederNow(now)) { editing = $0 }
                    SchedulesSaveFooter(model: model, target: target, zone: model.zone.value) { confirmation = $0 }
                } else {
                    oneOff
                }
                footnote(device: device)
            }
        }
    }

    @ViewBuilder
    private var oneOff: some View {
        LoadableBlock(state: model.zone, retry: retryZone) { zone in
            OneOffFeedsPanel(feeds: model.deferred, zone: zone, dual: model.feedTarget?.dual ?? false,
                             retry: retryDeferred,
                             onAdd: { editing = .oneOff },
                             onDelete: { feed in confirmation = deleteConfirmation(feed, zone: zone) })
        }
    }

    private func footnote(device: SchedulesDevice) -> some View {
        let zone = model.zone.value.map { ", \($0.label)" } ?? ""
        let noun = device.isFeeder ? "feeder" : "device"
        return Text("Times use the \(noun)'s own time zone\(zone), never this phone's. "
                    + "An empty schedule does not restrict the \(noun); a period that ends before it starts runs through midnight.")
            .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
            .padding(.horizontal, 4)
    }

    private func feederNow(_ date: Date) -> FeederNow? {
        guard let clock = model.zone.value?.clock else { return nil }
        return FeederNow(weekday: clock.weekday(date), second: clock.minuteOfDay(date) * 60)
    }

    // MARK: Calls

    private func retryAll() { Task { await reload() } }
    private func retryZone() { Task { await reloadZone() } }
    private func retryDeferred() { Task { await reloadDeferred() } }

    private func reload() async {
        guard loadsFromServer, let session else { return }
        await model.load(using: session)
    }

    private func reloadZone() async {
        guard loadsFromServer, let session else { return }
        await model.loadZone(using: session)
    }

    private func reloadDeferred() async {
        guard loadsFromServer, let session else { return }
        await model.loadDeferred(using: session)
    }

    private func addOneOff(_ feed: DeferredFeedDraft) async throws {
        guard let session else { throw APIError.notPaired }
        try await model.addDeferred(feed, using: session)
    }

    private func deleteConfirmation(_ feed: DeferredFeedItem, zone: DeviceZone) -> CommandConfirmation {
        CommandConfirmation(
            question: "Delete the feed at \(zone.clock.formatMoment(feed.fireAt))?",
            detail: "The feeder will not dispense this one-off feed. Scheduled meals are not affected.",
            confirmTitle: "Delete feed"
        ) { [session, model] in
            guard let session else { throw APIError.notPaired }
            try await model.deleteDeferred(feed, using: session)
        }
    }
}

/// The schedule tabs: pills while they fit, a scrolling chip row beyond three.
struct SchedulesTabs: View {
    let tabs: [(id: String, title: String)]
    @Binding var selection: String

    var body: some View {
        // Pills only when every title fits one line in a third of the width.
        if tabs.count <= 3 && tabs.allSatisfy({ $0.title.count <= 12 }) {
            SegmentedPills(options: tabs.map { ($0.id, $0.title) }, selection: $selection)
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(tabs, id: \.id) { tab in
                        Chip(title: tab.title, isSelected: tab.id == selection) { selection = tab.id }
                    }
                }
            }
        }
    }
}

#Preview("Feeder") {
    SchedulesView(model: SchedulesFixtures.model(SchedulesFixtures.feederDevice))
}

#Preview("Litter box") {
    SchedulesView(model: SchedulesFixtures.model(SchedulesFixtures.litterDevice))
}
