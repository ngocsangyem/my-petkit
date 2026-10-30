import PetkitCore
import SwiftUI

/// The selected cat's photo as the hero, with its name and recognition line.
struct PetHeroCard: View {
    let pet: PetRecord
    let tintIndex: Int
    let line: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PetPhoto(name: pet.name, photoPath: pet.photoPath, tintIndex: tintIndex)
                .frame(height: 230)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.panel))
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pet.name).font(Theme.Font.title).foregroundStyle(Theme.Color.text)
                        .accessibilityAddTraits(.isHeader)
                    Text(line).font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                }
                Spacer(minLength: 8)
                Pill(text: pet.faces.isEmpty ? "No face photos" : PetRules.plural(pet.faces.count, "face photo"),
                     tone: pet.faces.isEmpty ? .neutral : .positive)
                    .padding(.top, 6)
            }
            .padding(.horizontal, 8)
            .padding(.top, 12)
        }
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, Theme.Space.pad)
        .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }
}

/// Weight figures the API has: the registered weight and today's last weighed visit.
struct PetWeightCard: View {
    let pet: PetRecord
    let week: PetVisitWeek?

    var body: some View {
        Card {
            Text("Weight").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            FigureGrid(figures: [
                Figure(label: "Registered", value: kilograms(pet.weightG.map(Double.init) ?? pet.weight), unit: "kg"),
                Figure(label: lastLabel, value: kilograms(week?.lastWeight), unit: "kg"),
            ])
        }
    }

    private var lastLabel: String {
        guard let week, let time = TimelineFormat.clock(week.lastVisit, tzOffset: week.tzOffset) else {
            return "Last visit today"
        }
        return "Last visit, \(time)"
    }

    private func kilograms(_ grams: Double?) -> String? {
        TimelineFormat.weight(grams).map { $0.replacingOccurrences(of: " kg", with: "") }
    }
}

/// Litter-box visits per server day, from the timeline's per-day counts.
struct PetVisitsCard: View {
    let state: Loadable<PetVisitWeek>?
    let retry: () -> Void

    var body: some View {
        Card {
            HStack(alignment: .firstTextBaseline) {
                Text("Litter box visits").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
                Spacer()
                if let average = state?.value.flatMap({ PetRules.averagePerDay($0.days.map(\.count)) }) {
                    Text(String(format: "%.1f a day on average", average))
                        .font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
                }
            }
            LoadableBlock(state: state ?? .loading, loadingHeight: 96, retry: retry) { week in
                bars(week)
            }
        }
    }

    private func bars(_ week: PetVisitWeek) -> some View {
        let peak = max(week.days.map(\.count).max() ?? 0, 1)
        return HStack(alignment: .bottom, spacing: 8) {
            ForEach(week.days, id: \.date) { day in
                let isToday = day.date == week.today
                VStack(spacing: 6) {
                    Text("\(day.count)").font(Theme.Font.extraSmall).monospacedDigit()
                        .foregroundStyle(Theme.Color.muted)
                    RoundedRectangle(cornerRadius: 6)
                        .fill(isToday ? Theme.Color.accent : Theme.Color.litter)
                        .frame(height: max(4, 96 * CGFloat(day.count) / CGFloat(peak)))
                    Text(isToday ? "Today" : TimelineFormat.weekdayInitial(day.date))
                        .font(isToday ? Theme.Font.extraSmall.weight(.semibold) : Theme.Font.extraSmall)
                        .foregroundStyle(isToday ? Theme.Color.text : Theme.Color.muted)
                        .lineLimit(1)
                        .fixedSize()
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(TimelineFormat.dayTitle(day.date, today: week.today)): \(day.count) visits")
            }
        }
    }
}

/// The pet's reference photos, four to a row, with the add tile while there is room.
struct PetFacesCard: View {
    let pet: PetRecord
    let add: () -> Void
    let delete: (PetFaceRef) -> Void

    var body: some View {
        Card {
            HStack(alignment: .firstTextBaseline) {
                Text("Face photos").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
                Spacer()
                Text("\(pet.faces.count) of \(PetRules.maxFaces)").font(Theme.Font.small).monospacedDigit()
                    .foregroundStyle(Theme.Color.muted)
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                ForEach(pet.faces) { face in
                    RemoteImage(path: face.path) { Theme.Color.raised }
                        .aspectRatio(1, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .contextMenu {
                            Button("Delete photo", systemImage: "trash", role: .destructive) { delete(face) }
                        }
                        .onTapGesture { delete(face) }
                        .accessibilityLabel("Face photo \(face.id)")
                        .accessibilityHint("Offers to delete it")
                        .accessibilityAddTraits(.isButton)
                }
                if pet.faces.count < PetRules.maxFaces {
                    Button(action: add) {
                        Image(systemName: "camera")
                            .font(Theme.Font.iconLarge)
                            .foregroundStyle(Theme.Color.text)
                            .frame(maxWidth: .infinity)
                            .aspectRatio(1, contentMode: .fit)
                            .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Add a face photo")
                }
            }
            Text("Photos are cropped to 224 × 224 and sent to the camera, which matches visits on its own.")
                .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
        }
    }
}

/// A device-reported identity no pet holds, with Bind.
struct UnboundRefRow: View {
    let ref: UnboundPetRef
    let bind: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text("?").font(Theme.Font.section).foregroundStyle(Theme.Color.muted)
                .frame(width: 40, height: 40)
                .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: 12))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("A face not bound to a cat").font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                HStack(spacing: 0) {
                    Text("ref \(String(ref.ref))").font(Theme.Font.mono)
                    Text(" · seen \(PetRules.plural(ref.count, "time"))").font(Theme.Font.extraSmall).monospacedDigit()
                }
                .foregroundStyle(Theme.Color.muted)
            }
            Spacer(minLength: 8)
            Button("Bind", action: bind)
                .font(Theme.Font.control.weight(.semibold))
                .foregroundStyle(Theme.Color.accent)
                .accessibilityLabel("Bind ref \(String(ref.ref))")
        }
        .frame(minHeight: 64)
    }
}
