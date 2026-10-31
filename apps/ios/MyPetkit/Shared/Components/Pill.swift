import PetkitCore
import SwiftUI

/// A 22pt pill beside a value or title; the compact 18pt one sits inside a
/// line of small text.
struct Pill: View {
    enum Tone { case positive, negative, warning, neutral }

    let text: String
    var tone: Tone = .neutral
    var isCompact = false

    var body: some View {
        let (background, foreground) = colors
        Text(text)
            .font(isCompact ? Theme.Font.tab : Theme.Font.pill)
            .foregroundStyle(foreground)
            .padding(.horizontal, isCompact ? 7 : 9)
            .frame(height: isCompact ? 18 : Theme.Space.pill)
            .background(background, in: Capsule())
    }

    private var colors: (Color, Color) {
        switch tone {
        case .positive: Theme.Color.pillPositive
        case .negative: Theme.Color.pillNegative
        case .warning: Theme.Color.pillWarning
        case .neutral: Theme.Color.pillNeutral
        }
    }
}

/// Device connection state, drawn the same way everywhere.
enum DeviceStatus: Equatable {
    case online(transport: String?)
    case polling
    case offline
    case unknown

    var label: String {
        switch self {
        case .online: L10n.string("Online")
        case .polling: L10n.string("Polling")
        case .offline: L10n.string("Offline")
        case .unknown: L10n.string("Unknown")
        }
    }

    var tone: Pill.Tone {
        switch self {
        case .online: .positive
        case .offline: .negative
        case .polling, .unknown: .neutral
        }
    }
}

/// 8pt dot plus words; the status word is the only colour in its row.
struct StatusMark: View {
    let status: DeviceStatus

    var body: some View {
        HStack(spacing: 6) {
            if status == .unknown {
                Circle().stroke(Theme.Color.muted, lineWidth: 1.5).frame(width: 8, height: 8)
            } else {
                Circle().fill(color).frame(width: 8, height: 8)
            }
            Text(words).font(Theme.Font.small).foregroundStyle(color)
        }
        .accessibilityElement(children: .combine)
    }

    private var words: String {
        switch status {
        case .online(let transport): transport.map { L10n.string("Online · \($0)") } ?? L10n.string("Online")
        case .polling: L10n.string("Polling · heartbeat")
        case .offline: L10n.string("Offline")
        case .unknown: L10n.string("Unknown")
        }
    }

    private var color: Color {
        switch status {
        case .online: Theme.Color.positive
        case .polling: Theme.Color.chart2
        case .offline: Theme.Color.negative
        case .unknown: Theme.Color.muted
        }
    }
}
