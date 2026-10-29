import PetkitCore
import SwiftUI

extension FindingTone {
    var color: Color {
        switch self {
        case .positive: Theme.Color.positive
        case .warning: Theme.Color.warning
        case .negative: Theme.Color.negative
        case .neutral: Theme.Color.text
        }
    }
}

/// The cats, first on Home: photo, name, weight, and today's visits.
struct PetTiles: View {
    @Environment(TabRouter.self) private var router
    let pets: Loadable<[HomePetRecord]>
    let days: [Int: PetDay]
    let retry: () -> Void

    var body: some View {
        switch pets {
        case .loading:
            DeviceGrid { LoadingBars(lines: 1, height: 120); LoadingBars(lines: 1, height: 120) }
        case .failed(let message):
            BlockError(message: message, retry: retry)
        case .loaded(let list):
            if !list.isEmpty {
                DeviceGrid {
                    ForEach(Array(list.enumerated()), id: \.element.id) { index, pet in
                        Button { router.tab = .pets } label: { tile(pet, tintIndex: index) }
                            .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func tile(_ pet: HomePetRecord, tintIndex: Int) -> some View {
        Card(padding: 8) {
            PetPhoto(name: pet.name, photoPath: pet.photoPath, tintIndex: tintIndex)
                .frame(height: 120)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.thumbnail))
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline) {
                    Text(pet.name).font(Theme.Font.section).foregroundStyle(Theme.Color.text).lineLimit(1)
                    Spacer(minLength: 4)
                    if let weight = PetWeight.text(pet.weight) {
                        Text(weight).font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.text)
                    }
                }
                Text((days[pet.id] ?? PetDay()).summary)
                    .font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 6)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}

/// A registered weight as "5.42 kg". The pets table stores whatever was
/// entered; a value over 100 can only be grams, so it is read as such.
enum PetWeight {
    static func text(_ weight: Double?) -> String? {
        guard let weight, weight > 0 else { return nil }
        let kilograms = weight > 100 ? weight / 1000 : weight
        return String(format: "%.2f kg", kilograms)
    }
}

/// Two columns of equal cards.
struct DeviceGrid<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: Theme.Space.gap),
                            GridItem(.flexible(), spacing: Theme.Space.gap)],
                  spacing: Theme.Space.gap) { content }
    }
}

/// The drawing on its `raised` panel with the status pill over the corner.
struct DeviceArtPanel: View {
    let kind: DeviceKind
    var levels: (Double?, Double?) = (nil, nil)
    let status: DeviceStatus

    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: Theme.Radius.panel).fill(Theme.Color.raised)
            DeviceDrawing(kind: kind, level: levels.0, secondLevel: levels.1, height: 88)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.top, 14)
            Pill(text: status.label, tone: status.tone).padding(8)
        }
        .frame(height: 120)
    }
}

/// A device on Home: drawing with real state, status pill, one state line.
struct DeviceCard: View {
    let device: DeviceRecord
    let zone: TimeZone?
    let now: Date
    let nextMeal: PlannedMeal?

    var body: some View {
        let line = DeviceFindings.cardLine(device, zone: zone, now: now, nextMeal: nextMeal)
        Card(padding: 8) {
            DeviceArtPanel(kind: DeviceKind(deviceType: device.type), levels: DeviceFacts.drawingLevels(device),
                           status: DeviceFacts.status(device))
            VStack(alignment: .leading, spacing: 2) {
                Text(device.name).font(Theme.Font.bodyMedium.weight(.semibold))
                    .foregroundStyle(Theme.Color.text).lineLimit(1)
                Text(line?.0 ?? "—").font(Theme.Font.small).monospacedDigit()
                    .foregroundStyle(line.map { $0.1 == .neutral ? Theme.Color.muted : $0.1.color } ?? Theme.Color.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 6)
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens the device")
    }
}

/// A Bluetooth accessory on Home: it has no detail of its own, so a tap opens
/// the device that relays it, where its accessories are listed.
struct AccessoryCard: View {
    let accessory: BleAccessoryRecord
    let now: Date

    var body: some View {
        if let parent = accessory.linkWith {
            NavigationLink(value: DeviceRoute(id: parent)) { card }.buttonStyle(.plain)
        } else {
            card
        }
    }

    private var card: some View {
        Card(padding: 8) {
            DeviceArtPanel(kind: DeviceKind(deviceType: accessory.bleType), status: DeviceFacts.status(accessory))
            VStack(alignment: .leading, spacing: 2) {
                Text(accessory.name).font(Theme.Font.bodyMedium.weight(.semibold))
                    .foregroundStyle(Theme.Color.text).lineLimit(1)
                Text(line).font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted).lineLimit(1)
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 6)
        }
        .accessibilityElement(children: .combine)
    }

    private var line: String {
        guard let parent = accessory.parentName else { return "No device relays it" }
        let via = "Via the \(parent.lowercased())"
        guard let seen = DeviceFacts.epochSeconds(accessory.lastSeen) else { return "\(via) · never reported" }
        return "\(via) · \(DeviceFindings.duration(now.timeIntervalSince1970 - seen))"
    }
}

/// A device card at its final size while the list loads.
struct DeviceCardPlaceholder: View {
    var body: some View {
        Card(padding: 8) {
            RoundedRectangle(cornerRadius: Theme.Radius.panel).fill(Theme.Color.raised).frame(height: 120)
            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 4).fill(Theme.Color.track).frame(width: 90, height: 14)
                RoundedRectangle(cornerRadius: 4).fill(Theme.Color.rule).frame(width: 120, height: 12)
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 6)
        }
        .accessibilityLabel("Loading")
    }
}

/// Home with no device yet. Adding one (provisioning) is not in this build, so
/// the card explains instead of offering a button that would do nothing.
struct NoDevicesCard: View {
    var body: some View {
        Card {
            EmptyBlock(title: "Add your first device",
                       message: "Point a litter box, feeder or fountain at this server and it appears here.") {
                HStack(spacing: 10) {
                    DeviceDrawing(kind: .litterBox, height: 72)
                    DeviceDrawing(kind: .feederDual, height: 72)
                    DeviceDrawing(kind: .fountain, height: 72)
                }
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity)
                .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
                .opacity(0.6)
            }
        }
    }
}

/// The server did not answer at all.
struct UnreachableCard: View {
    let server: String
    let retry: () -> Void

    var body: some View {
        Card {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "icloud.slash").font(Theme.Font.iconLarge).foregroundStyle(Theme.Color.negative)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Can't reach your server").font(Theme.Font.bodyMedium.weight(.semibold))
                    Text("\(server) did not answer. Are you on the home Wi-Fi or Tailscale?")
                        .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Button("Retry", action: retry).buttonStyle(.secondary)
        }
    }
}

/// The household day strip with a link to the Timeline tab.
struct TodayCard: View {
    let sessions: Loadable<[TimelineSessionRecord]>
    let day: HouseholdDay
    let now: Date
    let retry: () -> Void
    let openTimeline: () -> Void

    var body: some View {
        Card(padding: 16) {
            HStack(alignment: .firstTextBaseline) {
                Text("Today").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
                Spacer()
                Button("Timeline", action: openTimeline)
                    .font(Theme.Font.control.weight(.semibold)).foregroundStyle(Theme.Color.accent)
            }
            switch sessions {
            case .loading: LoadingBars(lines: 0, height: 96)
            case .failed(let message): BlockError(message: message, retry: retry)
            case .loaded:
                if let zone = day.homeZone {
                    DayStripView(lanes: day.lanes, zone: zone, now: now)
                } else {
                    Text("The strip appears once a device has said which timezone it is in.")
                        .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                }
            }
        }
    }
}
