import PetkitCore
import SwiftUI

/// The household day strip: a 24 h axis, one lane per pet, then meals and
/// fountain lanes, and the now line. The axis and the now line are drawn in
/// `zone` (a device's zone, never the phone's); each lane's marks were already
/// placed in their own device's zone.
struct DayStripView: View {
    let lanes: [DayStripLane]
    let zone: TimeZone
    var now: Date = .now

    private static let labelWidth: CGFloat = 54
    private static let laneHeight: CGFloat = 24

    var body: some View {
        let nowMinute = DayStripLayout.minuteOfDay(now, in: zone)
        Grid(alignment: .leading, horizontalSpacing: 8, verticalSpacing: 6) {
            GridRow {
                Color.clear.frame(width: Self.labelWidth, height: 1)
                axis(nowMinute: nowMinute)
            }
            ForEach(lanes) { lane in
                GridRow {
                    Text(lane.title)
                        .font(isPet(lane) ? Theme.Font.smallMedium : Theme.Font.small)
                        .foregroundStyle(isPet(lane) ? Theme.Color.text : Theme.Color.muted)
                        .lineLimit(1)
                        .frame(width: Self.labelWidth, alignment: .leading)
                    LaneTrack(lane: lane, nowMinute: nowMinute)
                        .frame(height: Self.laneHeight)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(accessibilityText(lane))
            }
        }
    }

    private func isPet(_ lane: DayStripLane) -> Bool {
        if case .visits = lane.marks { return true }
        return false
    }

    private func axis(nowMinute: Double) -> some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            ZStack(alignment: .topLeading) {
                Text("00").position(x: 8, y: 7)
                Text("12").position(x: width / 2, y: 7)
                Text("24").position(x: width - 8, y: 7)
                Text(DayStripLayout.clock(minute: nowMinute))
                    .font(Theme.Font.pill.weight(.semibold))
                    .foregroundStyle(Theme.Color.accent)
                    .padding(.horizontal, 3)
                    .background(Theme.Color.surface)
                    .fixedSize()
                    .position(x: min(max(DayStripLayout.x(minute: nowMinute, width: width), 20), width - 20), y: 7)
                    .accessibilityLabel("Now \(DayStripLayout.clock(minute: nowMinute))")
            }
            .font(Theme.Font.tab)
            .monospacedDigit()
            .foregroundStyle(Theme.Color.muted)
        }
        .frame(height: 14)
    }

    private func accessibilityText(_ lane: DayStripLane) -> String {
        switch lane.marks {
        case .visits(let minutes, _):
            let times = minutes.map { DayStripLayout.clock(minute: $0) }.joined(separator: ", ")
            return minutes.isEmpty ? L10n.string("\(lane.title): no visits") : L10n.string("\(lane.title): visits at \(times)")
        case .meals(let meals):
            let text = meals.map {
                let clock = DayStripLayout.clock(minute: $0.minute)
                return $0.fed ? L10n.string("\(clock) fed") : L10n.string("\(clock) planned")
            }
            return "\(lane.title): \(text.joined(separator: ", "))"
        case .fountain(let spans):
            let quiet = spans.first { !$0.reporting }
            return quiet.map { L10n.string("\(lane.title): no report since \(DayStripLayout.clock(minute: $0.start))") }
                ?? L10n.string("\(lane.title): reporting")
        }
    }
}

/// One lane: the `raised` track, its marks, and the now line.
private struct LaneTrack: View {
    let lane: DayStripLane
    let nowMinute: Double

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 8).fill(Theme.Color.raised)
                marks(width: width)
                Rectangle().fill(Theme.Color.accent)
                    .frame(width: 1)
                    .offset(x: DayStripLayout.x(minute: nowMinute, width: width))
            }
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    @ViewBuilder
    private func marks(width: CGFloat) -> some View {
        switch lane.marks {
        case .visits(let minutes, let tintIndex):
            let ink = Theme.Color.catTints[tintIndex % Theme.Color.catTints.count].1
            ForEach(Array(minutes.enumerated()), id: \.offset) { _, minute in
                RoundedRectangle(cornerRadius: 1.5).fill(ink)
                    .frame(width: 3, height: 16)
                    .offset(x: DayStripLayout.markOrigin(minute: minute, markWidth: 3, width: width), y: 4)
            }
        case .meals(let meals):
            ForEach(Array(meals.enumerated()), id: \.offset) { _, meal in
                Group {
                    if meal.fed {
                        RoundedRectangle(cornerRadius: 2).fill(Theme.Color.text)
                    } else {
                        RoundedRectangle(cornerRadius: 2).strokeBorder(Theme.Color.text, lineWidth: 1.5)
                    }
                }
                .frame(width: 8, height: 8)
                .offset(x: DayStripLayout.markOrigin(minute: meal.minute, markWidth: 8, width: width), y: 8)
            }
        case .fountain(let spans):
            ForEach(Array(spans.enumerated()), id: \.offset) { _, span in
                if let frame = DayStripLayout.spanFrame(span, width: width) {
                    Group {
                        if span.reporting {
                            Rectangle().fill(Theme.Color.fountainReporting)
                        } else {
                            Hatch().stroke(Theme.Color.negative, lineWidth: 1)
                        }
                    }
                    .frame(width: frame.width, height: 12)
                    .clipped()
                    .offset(x: frame.x, y: 6)
                }
            }
        }
    }
}

/// Diagonal hatch for a fountain that has gone quiet: a pattern, not a gradient.
private struct Hatch: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        var x = rect.minX - rect.height
        while x < rect.maxX {
            path.move(to: CGPoint(x: x, y: rect.maxY))
            path.addLine(to: CGPoint(x: x + rect.height, y: rect.minY))
            x += 5
        }
        return path
    }
}

#Preview("Day strip") {
    let zone = TimeZone(identifier: "Asia/Saigon") ?? .current
    DayStripView(
        lanes: [
            DayStripLane(id: "p1", title: "Miso", marks: .visits(minutes: [72, 511, 838], tintIndex: 0)),
            DayStripLane(id: "p2", title: "Mochi", marks: .visits(minutes: [227, 665], tintIndex: 1)),
            DayStripLane(id: "m", title: "Meals", marks: .meals([
                .init(minute: 420, fed: true), .init(minute: 720, fed: true),
                .init(minute: 1080, fed: false), .init(minute: 1320, fed: false),
            ])),
            DayStripLane(id: "f", title: "Fountain", marks: .fountain([
                .init(start: 0, end: 370, reporting: true), .init(start: 370, end: 887, reporting: false),
            ])),
        ],
        zone: zone,
        now: Date(timeIntervalSince1970: 1_793_173_620)
    )
    .padding()
    .background(Theme.Color.surface)
}
