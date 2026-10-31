import PetkitCore
import SwiftUI

/// "Now" on the feeder's clock, for the now line.
struct FeederNow: Equatable {
    /// Sunday 1.
    let weekday: Int
    let second: Int
}

/// A feeder's meals: sets of meals sharing weekdays, each meal a card with its
/// time and portions. On the sets that run today a line marks the feeder's now.
struct FeedEditor: View {
    let groups: [FeedGroup]
    let dual: Bool
    /// Nil until the feeder's time zone has loaded: no now line without it.
    let now: FeederNow?
    let onEdit: (ScheduleEditing) -> Void
    let onDays: (Int, WeekdaySet) -> Void
    let onAddGroup: () -> Void
    let onRemoveGroup: (Int) -> Void

    var body: some View {
        if groups.isEmpty {
            Card {
                EmptyBlock(title: L10n.string("No meals set"),
                           message: L10n.string("The feeder dispenses only when you press Feed."),
                           actionTitle: L10n.string("Add a meal")) { onEdit(.meal(group: 0, index: nil)) }
            }
        } else {
            ForEach(Array(groups.enumerated()), id: \.element.id) { index, group in
                groupView(index: index, group: group)
            }
            Button(action: onAddGroup) {
                Label("Add meals on other days", systemImage: "plus")
            }
            .font(Theme.Font.control)
            .foregroundStyle(Theme.Color.accent)
            .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
        }
    }

    @ViewBuilder
    private func groupView(index: Int, group: FeedGroup) -> some View {
        Card {
            HStack {
                Text(groups.count > 1 ? L10n.string("Meals on \(group.days.summary)") : group.days.summary)
                    .font(Theme.Font.section).accessibilityAddTraits(.isHeader)
                Spacer()
                if groups.count > 1 {
                    Button("Remove") { onRemoveGroup(index) }
                        .font(Theme.Font.control)
                        .foregroundStyle(Theme.Color.negative)
                        .accessibilityLabel("Remove meals on \(group.days.summary)")
                }
            }
            WeekdayPicker(days: Binding(get: { group.days }, set: { onDays(index, $0) }))
        }
        // Shown in time order; the draft keeps the order it was given.
        let order = group.meals.indices.sorted { group.meals[$0].second < group.meals[$1].second }
        let runsToday = now.map { group.days.contains(.day($0.weekday)) } ?? false
        let line = now.map { ScheduleFeedPlan.nowLineIndex(sortedSeconds: order.map { group.meals[$0].second }, nowSecond: $0.second) }
        VStack(spacing: 10) {
            if group.meals.isEmpty {
                Text("No meals on these days.").font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
            }
            ForEach(Array(order.enumerated()), id: \.element) { position, mealIndex in
                if runsToday, let now, position == line {
                    NowLine(second: now.second)
                }
                MealCard(meal: group.meals[mealIndex], number: position + 1, dual: dual,
                         isNext: runsToday && position == line) {
                    onEdit(.meal(group: index, index: mealIndex))
                }
            }
            if runsToday, let now, line == order.count, !order.isEmpty {
                NowLine(second: now.second)
            }
            AddRowButton(title: L10n.string("Add a meal")) { onEdit(.meal(group: index, index: nil)) }
        }
    }
}

/// One meal: the time large, portions beside it. The next meal today is
/// outlined in ink, the way the artboard marks it.
struct MealCard: View {
    let meal: FeedMeal
    let number: Int
    let dual: Bool
    let isNext: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(display(ScheduleClock.format(second: meal.second).nilIfEmpty))
                        .font(Theme.Font.figureInRow).monospacedDigit()
                    Text("Meal \(number)").font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                }
                .frame(minWidth: 64, alignment: .leading)
                VStack(alignment: .leading, spacing: 2) {
                    let total = meal.hopper1 + (dual ? meal.hopper2 : 0)
                    Text(L10n.string("\(total) portions")).font(Theme.Font.body).monospacedDigit()
                    if dual {
                        Text(PortionRules.describe(hopper1: meal.hopper1, hopper2: meal.hopper2, dual: true))
                            .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted).monospacedDigit()
                    }
                }
                Spacer(minLength: 8)
                if isNext { Pill(text: L10n.string("Next")) }
                Image(systemName: "chevron.right").font(Theme.Font.chevron)
                    .foregroundStyle(Theme.Color.muted).accessibilityHidden(true)
            }
            .foregroundStyle(Theme.Color.text)
            .padding(.horizontal, Theme.Space.pad)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
            .overlay {
                if isNext {
                    RoundedRectangle(cornerRadius: Theme.Radius.card).strokeBorder(Theme.Color.text, lineWidth: 2)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityHint("Edit this meal")
    }
}

/// "Now 14:47" and an accent rule, on the feeder's clock.
struct NowLine: View {
    let second: Int

    var body: some View {
        HStack(spacing: 8) {
            Text("Now \(ScheduleClock.format(second: second))")
                .font(Theme.Font.pill).monospacedDigit()
            Rectangle().frame(height: 1)
        }
        .foregroundStyle(Theme.Color.accent)
        .padding(.horizontal, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Now, \(ScheduleClock.format(second: second)) on the feeder's clock")
    }
}

private extension String {
    /// Nil for the empty string, so `display(_:)` prints an em dash.
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

#Preview("Feed editor") {
    ScrollView {
        VStack(spacing: 12) {
            FeedEditor(groups: SchedulesFixtures.feedGroups, dual: true,
                       now: FeederNow(weekday: 3, second: 14 * 3600 + 47 * 60),
                       onEdit: { _ in }, onDays: { _, _ in }, onAddGroup: {}, onRemoveGroup: { _ in })
        }
        .padding()
    }
    .background(Theme.Color.ground)
}
