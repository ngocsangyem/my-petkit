import PetkitCore
import SwiftUI

/// Pending one-off feeds. Every date and time here is on the FEEDER's clock,
/// both when the server turns the request into `fire_at` and when the list
/// prints `fire_at` back, so the phone's own zone never enters into it.
struct OneOffFeedsPanel: View {
    let feeds: Loadable<[DeferredFeedItem]>
    let zone: DeviceZone
    let dual: Bool
    let retry: () -> Void
    let onAdd: () -> Void
    let onDelete: (DeferredFeedItem) -> Void

    var body: some View {
        LoadableBlock(state: feeds, retry: retry) { list in
            if list.isEmpty {
                Card {
                    EmptyBlock(title: "No one-off feeds",
                               message: "A one-off feed dispenses once, at a date and time you pick.")
                }
            } else {
                Card(padding: 4) {
                    VStack(spacing: 0) {
                        ForEach(Array(list.enumerated()), id: \.element.id) { index, feed in
                            if index > 0 { RowRule() }
                            row(feed)
                        }
                    }
                    .padding(.horizontal, 12)
                }
            }
        }
        AddRowButton(title: "Schedule a one-off feed", action: onAdd)
    }

    private func row(_ feed: DeferredFeedItem) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(zone.clock.formatMoment(feed.fireAt)).font(Theme.Font.bodyMedium).monospacedDigit()
                Text(PortionRules.describe(hopper1: feed.hopper1, hopper2: feed.hopper2, dual: dual))
                    .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted).monospacedDigit()
            }
            Spacer(minLength: 8)
            Button("Delete") { onDelete(feed) }
                .font(Theme.Font.control.weight(.semibold))
                .foregroundStyle(Theme.Color.negative)
                .accessibilityLabel("Delete the feed at \(zone.clock.formatMoment(feed.fireAt))")
        }
        .frame(minHeight: Theme.Space.rowHeight)
    }
}

/// Date, time and portions of a new one-off feed. The picker runs on the
/// feeder's calendar and zone. Continue asks first: the confirm sheet opens
/// on top of this one and closes both once the server has the feed.
struct OneOffFeedSheet: View {
    @Environment(\.dismiss) private var dismiss
    let zone: DeviceZone
    @State var form: DeferredFeedForm
    let submit: @MainActor (DeferredFeedDraft) async throws -> Void
    @State private var confirmation: CommandConfirmation?
    @State private var scheduled = false

    var body: some View {
        ScheduleSheetFrame(title: "Schedule a one-off feed", problem: problem, doneTitle: "Continue",
                           dismissesOnDone: false, onDone: ask) {
            DatePicker("When", selection: $form.moment, in: Date.now..., displayedComponents: [.date, .hourAndMinute])
                .font(Theme.Font.body)
                .environment(\.timeZone, zone.clock.timeZone)
                .environment(\.calendar, zone.clock.calendar)
            HStack(alignment: .top, spacing: 10) {
                PortionField(label: form.dual ? "Hopper 1 portions" : "Portions", text: $form.hopper1,
                             max: PortionRules.oneOffMax)
                if form.dual {
                    PortionField(label: "Hopper 2 portions", text: $form.hopper2, max: PortionRules.oneOffMax)
                }
            }
            Text("On the feeder's clock (\(zone.label)).")
                .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
        }
        .sheet(item: $confirmation, onDismiss: { if scheduled { dismiss() } }, content: { ConfirmCommandSheet(confirmation: $0) })
    }

    private var problem: String? {
        if case .failure(let problem) = form.validated(clock: zone.clock, now: .now) { return problem.message }
        return nil
    }

    private func ask() {
        guard case .success(let draft) = form.validated(clock: zone.clock, now: .now) else { return }
        let portions = PortionRules.describe(hopper1: draft.hopper1, hopper2: draft.hopper2, dual: form.dual)
        confirmation = CommandConfirmation(
            question: "Feed on \(draft.date) at \(draft.time)?",
            detail: "\(portions), once, on the feeder's clock (\(zone.label)). The feeder picks it up on its next check-in.",
            confirmTitle: "Schedule feed"
        ) {
            try await submit(draft)
            scheduled = true
        }
    }
}

#Preview("One-off feeds") {
    ScrollView {
        VStack(spacing: 12) {
            OneOffFeedsPanel(feeds: .loaded(SchedulesFixtures.deferred), zone: SchedulesFixtures.zone, dual: true,
                             retry: {}, onAdd: {}, onDelete: { _ in })
        }
        .padding()
    }
    .background(Theme.Color.ground)
}
