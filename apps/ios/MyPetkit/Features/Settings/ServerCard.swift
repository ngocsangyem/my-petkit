import PetkitCore
import SwiftUI

/// The server card: the mark, the address with its state and trust, the
/// version and mode, then the Devices and Need you figures.
struct ServerCard: View {
    @Environment(ServerSession.self) private var session
    let model: ServerModel

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.gap) {
            hero
            switch model.devices {
            case .loading: LoadingBars(lines: 0, height: 76)
            case .failed(let message):
                BlockError(message: message) { Task { await model.loadDevices() } }
            case .loaded(let figures): figuresPanel(figures)
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 14)
        .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }

    private var hero: some View {
        HStack(spacing: 14) {
            DrumMark(size: 56)
            VStack(alignment: .leading, spacing: 2) {
                Text(session.serverName).font(Theme.Font.section).foregroundStyle(Theme.Color.text)
                    .lineLimit(1)
                stateLine
                if case .failed(let message) = model.facts {
                    Text(message).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                } else if let facts = model.facts.value {
                    Text(verbatim: "MyPetKit \(facts.version) · "
                         + (facts.proxyMode ? L10n.string("proxy mode") : L10n.string("local mode")))
                        .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(Theme.Space.pad)
        .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.hero))
        .accessibilityElement(children: .combine)
    }

    private var stateLine: some View {
        let trust = session.isPinned ? L10n.string("TLS pinned") : L10n.string("TLS, system-trusted")
        let (word, color): (String, Color) = switch (session.connection, model.facts) {
        case (_, .failed): (L10n.string("Not answering"), Theme.Color.negative)
        case (.live, _): (L10n.string("Running"), Theme.Color.positive)
        default: (L10n.string("Reconnecting"), Theme.Color.muted)
        }
        return HStack(spacing: 6) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(verbatim: "\(word) · \(trust)").font(Theme.Font.small).foregroundStyle(color)
        }
    }

    private func figuresPanel(_ figures: ServerModel.DeviceFigures) -> some View {
        HStack(spacing: 0) {
            figure(L10n.string("Devices"), value: figures.total, color: Theme.Color.text)
            Rectangle().fill(Theme.Color.segment).frame(width: 1)
            figure(L10n.string("Need you"), value: figures.needYou,
                   color: figures.needYou > 0 ? Theme.Color.negative : Theme.Color.text)
        }
        .fixedSize(horizontal: false, vertical: true)
        .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
    }

    private func figure(_ label: String, value: Int, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
            Text("\(value)").font(Theme.Font.figure).monospacedDigit().foregroundStyle(color)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}
