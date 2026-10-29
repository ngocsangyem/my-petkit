import PetkitCore
import SwiftUI

/// One figure: a small muted label over a large value with a muted unit.
/// A missing value prints a muted em dash; a zero prints 0.
struct Figure: Identifiable {
    let label: String
    let value: String?
    var unit: String?
    var id: String { label }
}

/// The 2×N figure container: one `raised` panel split by 1pt rules.
struct FigureGrid: View {
    let figures: [Figure]

    var body: some View {
        let rows = stride(from: 0, to: figures.count, by: 2).map { Array(figures[$0..<min($0 + 2, figures.count)]) }
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                if index > 0 { Rectangle().fill(Theme.Color.segment).frame(height: 1) }
                HStack(spacing: 0) {
                    ForEach(Array(row.enumerated()), id: \.element.id) { column, figure in
                        if column > 0 { Rectangle().fill(Theme.Color.segment).frame(width: 1) }
                        cell(figure)
                    }
                    if row.count == 1 {
                        Rectangle().fill(Theme.Color.segment).frame(width: 1)
                        Color.clear.frame(maxWidth: .infinity)
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
    }

    private func cell(_ figure: Figure) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(figure.label).font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                if let value = figure.value {
                    Text(value).font(Theme.Font.figureInRow).monospacedDigit()
                        .foregroundStyle(Theme.Color.text)
                    if let unit = figure.unit {
                        Text(unit).font(Theme.Font.body).foregroundStyle(Theme.Color.muted)
                    }
                } else {
                    Text("—").font(Theme.Font.figureInRow).foregroundStyle(Theme.Color.muted)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// 6pt track with the fill at the true ratio and the label at the right.
struct RatioBar: View {
    let ratio: Double?
    let label: String
    var tint: Color = Theme.Color.accent

    var body: some View {
        HStack(spacing: 10) {
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.Color.track)
                    Capsule().fill(tint)
                        .frame(width: geometry.size.width * min(max(ratio ?? 0, 0), 1))
                }
            }
            .frame(height: 6)
            Text(label).font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
        }
        .accessibilityElement(children: .combine)
    }
}
