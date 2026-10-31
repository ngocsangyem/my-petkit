import PetkitCore
import SwiftUI

/// Fields of one period, shared by the period sheet and the weekly sheet.
struct RangeFormFields: View {
    @Binding var form: RangeForm

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Toggle("All day", isOn: $form.isAllDay)
                .font(Theme.Font.body)
                .tint(Theme.Color.text)
            if !form.isAllDay {
                HStack(spacing: 10) {
                    ClockField(label: L10n.string("From"), text: $form.start, allowsEndOfDay: true)
                    ClockField(label: L10n.string("To"), text: $form.end, allowsEndOfDay: true)
                }
                if case .success(let range) = form.validated(), range.crossesMidnight {
                    Text("Ends the next day.").font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                }
            }
        }
    }
}

/// Edit or add one period of a range list.
struct RangeEditSheet: View {
    let isNew: Bool
    @State var form: RangeForm
    let onDone: (ScheduleRange) -> Void
    let onRemove: () -> Void

    var body: some View {
        ScheduleSheetFrame(title: isNew ? L10n.string("Add a period") : L10n.string("Edit period"), problem: problem,
                           onRemove: isNew ? nil : onRemove, onDone: done) {
            RangeFormFields(form: $form)
        }
    }

    private var problem: String? {
        if case .failure(let problem) = form.validated() { return problem.message }
        return nil
    }

    private func done() {
        if case .success(let range) = form.validated() { onDone(range) }
    }
}

/// Edit or add one weekly entry: switch, days, and its periods.
struct WeeklyEditSheet: View {
    let isNew: Bool
    let entryID: UUID
    @State var form: WeeklyForm
    let onDone: (WeeklyEntry) -> Void
    let onRemove: () -> Void

    var body: some View {
        ScheduleSheetFrame(title: isNew ? L10n.string("Add an entry") : L10n.string("Edit entry"), problem: problem,
                           onRemove: isNew ? nil : onRemove, onDone: done) {
            Toggle("On", isOn: $form.enabled).font(Theme.Font.body).tint(Theme.Color.text)
            WeekdayPicker(days: $form.days)
            ForEach(form.ranges.indices, id: \.self) { index in
                Panel {
                    HStack {
                        Text("Period \(index + 1)").font(Theme.Font.smallMedium)
                        Spacer()
                        Button("Remove") { form.ranges.remove(at: index) }
                            .font(Theme.Font.control)
                            .foregroundStyle(Theme.Color.negative)
                            .accessibilityLabel("Remove period \(index + 1)")
                    }
                    RangeFormFields(form: $form.ranges[index])
                }
            }
            Button {
                form.ranges.append(RangeForm(isAllDay: true))
            } label: {
                Label("Add a period", systemImage: "plus")
            }
            .buttonStyle(.secondary)
        }
    }

    private var problem: String? {
        if case .failure(let problem) = form.validated(keeping: entryID) { return problem.message }
        return nil
    }

    private func done() {
        if case .success(let entry) = form.validated(keeping: entryID) { onDone(entry) }
    }
}

/// Edit or add a litter-box job time.
struct PointEditSheet: View {
    let isNew: Bool
    let sectionName: String
    let point: PointEntry
    @State var form: PointForm
    let onDone: (PointEntry) -> Void
    let onRemove: () -> Void

    var body: some View {
        ScheduleSheetFrame(title: isNew ? L10n.string("Add a time: \(sectionName)") : sectionName, problem: problem,
                           onRemove: isNew ? nil : onRemove, onDone: done) {
            ClockField(label: L10n.string("Time"), text: $form.time)
            WeekdayPicker(days: $form.days)
        }
    }

    private var problem: String? {
        if case .failure(let problem) = form.validated(onto: point) { return problem.message }
        return nil
    }

    private func done() {
        if case .success(let updated) = form.validated(onto: point) { onDone(updated) }
    }
}

/// Edit or add a feeder meal: time and a portion count per hopper.
struct MealEditSheet: View {
    let isNew: Bool
    let meal: FeedMeal
    @State var form: MealForm
    let onDone: (FeedMeal) -> Void
    let onRemove: () -> Void

    var body: some View {
        ScheduleSheetFrame(title: isNew ? L10n.string("Add a meal") : L10n.string("Edit meal"), problem: problem,
                           onRemove: isNew ? nil : onRemove, onDone: done) {
            ClockField(label: L10n.string("Time on the feeder's clock"), text: $form.time)
            HStack(alignment: .top, spacing: 10) {
                PortionField(label: form.dual ? L10n.string("Hopper 1 portions") : L10n.string("Portions"), text: $form.hopper1,
                             max: PortionRules.scheduleMax)
                if form.dual {
                    PortionField(label: L10n.string("Hopper 2 portions"), text: $form.hopper2, max: PortionRules.scheduleMax)
                }
            }
        }
    }

    private var problem: String? {
        if case .failure(let problem) = form.validated(onto: meal) { return problem.message }
        return nil
    }

    private func done() {
        if case .success(let updated) = form.validated(onto: meal) { onDone(updated) }
    }
}

#Preview("Meal sheet") {
    Color.clear.sheet(isPresented: .constant(true)) {
        MealEditSheet(isNew: false, meal: SchedulesFixtures.dinner,
                      form: MealForm(SchedulesFixtures.dinner, dual: true), onDone: { _ in }, onRemove: {})
    }
}

#Preview("Weekly sheet") {
    Color.clear.sheet(isPresented: .constant(true)) {
        WeeklyEditSheet(isNew: true, entryID: UUID(), form: WeeklyForm(), onDone: { _ in }, onRemove: {})
    }
}
