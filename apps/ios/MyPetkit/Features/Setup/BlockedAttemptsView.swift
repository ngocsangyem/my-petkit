import PetkitAPI
import PetkitCore
import SwiftUI

/// What PetKit's cloud tried to do to a device and was refused, newest
/// first. Payloads arrive masked (a short prefix plus the length).
struct BlockedAttemptsView: View {
    let model: ServerSetupModel

    var body: some View {
        ScreenScroll {
            PushedScreenHeader(title: "Blocked attempts",
                               lede: "Recorded only while proxy mode forwards to PetKit's cloud.")
        } content: {
            LoadableBlock(state: model.blocked, retry: { Task { await model.loadBlocked() } }, content: { records in
                if records.isEmpty {
                    Card {
                        EmptyBlock(title: "Nothing blocked",
                                   message: "The guards have not had to refuse anything the cloud sent.")
                    }
                } else {
                    RowsCard {
                        ForEach(Array(records.enumerated()), id: \.element.id) { index, record in
                            if index > 0 { RowRule() }
                            row(record)
                        }
                    }
                }
            })
        }
        .refreshable { await model.loadBlocked() }
        .toolbar(.hidden, for: .navigationBar)
        .privacyShielded()
    }

    private func row(_ record: SetupBlockedAttempt) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(SetupRules.ruleLabel(record.kind)).font(Theme.Font.bodyMedium).foregroundStyle(Theme.Color.text)
                Spacer(minLength: 8)
                Text(Date(timeIntervalSince1970: record.createdAt).formatted(.relative(presentation: .named)))
                    .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
            }
            Text(metaLine(record)).font(Theme.Font.mono).foregroundStyle(Theme.Color.muted).lineLimit(2)
            if let payload = record.payloadJson, !payload.isEmpty {
                Text(payload).font(Theme.Font.mono).foregroundStyle(Theme.Color.lede).lineLimit(3)
            }
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
    }

    private func metaLine(_ record: SetupBlockedAttempt) -> String {
        [record.deviceId.map(String.init), record.transport?.rawValue, record.endpoint]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }
}
