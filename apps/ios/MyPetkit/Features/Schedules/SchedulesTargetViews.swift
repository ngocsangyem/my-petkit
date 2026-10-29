import PetkitAPI
import PetkitCore
import SwiftUI

/// The editor for one schedule, chosen by its kind.
struct SchedulesTargetEditor: View {
    let model: SchedulesModel
    let target: ScheduleTargetInfo
    let now: FeederNow?
    let onEdit: (ScheduleEditing) -> Void

    var body: some View {
        switch model.shown(target) {
        case .ranges(let ranges):
            RangeListEditor(ranges: ranges, onEdit: onEdit)
        case .weekly(let entries):
            WeeklyEditor(entries: entries, onEdit: onEdit) { index, enabled in
                model.edit(target) { $0.setEnabled(enabled, weeklyAt: index) }
            }
        case .points(let points):
            PointsEditor(points: points, onEdit: onEdit)
        case .feed(let groups):
            FeedEditor(groups: groups, dual: target.dual, now: now, onEdit: onEdit,
                       onDays: { index, days in model.edit(target) { $0.setDays(days, groupAt: index) } },
                       onAddGroup: { model.edit(target) { $0.addFeedGroup() } },
                       onRemoveGroup: { index in model.edit(target) { $0.removeFeedGroup(at: index) } })
        }
    }
}

/// Save and Discard once something has changed, the reason Save is off when
/// the server would refuse the draft, and the last save's outcome.
struct SchedulesSaveFooter: View {
    let model: SchedulesModel
    let target: ScheduleTargetInfo
    let zone: DeviceZone?
    let confirm: (CommandConfirmation) -> Void
    @Environment(ServerSession.self) private var session: ServerSession?

    var body: some View {
        if let draft = model.drafts[target.target] {
            VStack(spacing: 8) {
                if let problem = draft.problem {
                    Text(problem).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Button("Save \(target.name)") { confirm(confirmation) }
                    .buttonStyle(.primary)
                    .disabled(draft.problem != nil)
                Button("Discard changes") { model.discard(target) }
                    .font(Theme.Font.button)
                    .foregroundStyle(Theme.Color.text)
                    .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
            }
        } else if let notice = model.notice {
            Text(notice).font(Theme.Font.small).foregroundStyle(Theme.Color.positive)
                .padding(.horizontal, 4)
        }
    }

    private var confirmation: CommandConfirmation {
        let clock = zone.map { " (\($0.label))" } ?? ""
        return CommandConfirmation(
            question: "Save \(target.name)?",
            detail: "The device is sent this whole schedule as shown and runs it on its own clock\(clock).",
            confirmTitle: "Save and send"
        ) { [session, model, target] in
            guard let session else { throw APIError.notPaired }
            try await model.save(target, using: session)
        }
    }
}

/// The sheet for whichever row is being edited or added.
struct SchedulesEditSheet: View {
    let model: SchedulesModel
    let editing: ScheduleEditing
    let submitOneOff: @MainActor (DeferredFeedDraft) async throws -> Void

    var body: some View {
        if case .oneOff = editing, let zone = model.zone.value {
            OneOffFeedSheet(zone: zone, form: DeferredFeedForm(moment: Self.defaultMoment(), dual: model.feedTarget?.dual ?? false),
                            submit: submitOneOff)
        } else if let target = model.currentTarget {
            sheet(target: target, draft: model.shown(target))
        }
    }

    @ViewBuilder
    private func sheet(target: ScheduleTargetInfo, draft: ScheduleDraft) -> some View {
        let remove = { model.edit(target) { $0.removeRow(editing) } }
        switch (editing, draft) {
        case (.range(let index), .ranges(let ranges)):
            RangeEditSheet(isNew: index == nil, form: index.flatMap { ranges[safe: $0] }.map(RangeForm.init) ?? RangeForm(),
                           onDone: { range in model.edit(target) { $0.put(range, at: index) } }, onRemove: remove)
        case (.weekly(let index), .weekly(let entries)):
            let entry = index.flatMap { entries[safe: $0] }
            WeeklyEditSheet(isNew: index == nil, entryID: entry?.id ?? UUID(), form: entry.map(WeeklyForm.init) ?? WeeklyForm(),
                            onDone: { updated in model.edit(target) { $0.put(updated, at: index) } }, onRemove: remove)
        case (.point(let index, let type), .points(let points)):
            let point = index.flatMap { points[safe: $0] }
                ?? PointEntry(serverID: draft.nextPointID, type: type, days: .everyDay, minute: 0)
            PointEditSheet(isNew: index == nil, sectionName: Self.sectionName(type), point: point,
                           form: index == nil ? PointForm() : PointForm(point),
                           onDone: { updated in model.edit(target) { $0.put(updated, at: index) } }, onRemove: remove)
        case (.meal(let group, let index), .feed(let groups)):
            let meal = index.flatMap { groups[safe: group]?.meals[safe: $0] }
                ?? FeedMeal(mealID: .int(draft.nextMealID), second: 0, hopper1: 1, hopper2: 0)
            MealEditSheet(isNew: index == nil, meal: meal,
                          form: index == nil ? MealForm(dual: target.dual) : MealForm(meal, dual: target.dual),
                          onDone: { updated in model.edit(target) { $0.put(updated, group: group, at: index) } },
                          onRemove: remove)
        default:
            EmptyView()
        }
    }

    private static func sectionName(_ type: Int) -> String {
        ScheduleDraft.pointSections.first { $0.type == type }?.name ?? "Type \(type)"
    }

    /// An hour from now on the minute: a moment the server will accept.
    private static func defaultMoment() -> Date {
        let later = Date.now.addingTimeInterval(3600)
        return Date(timeIntervalSince1970: (later.timeIntervalSince1970 / 60).rounded(.down) * 60)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
