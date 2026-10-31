import PetkitAPI
import PetkitCore
import SwiftUI

/// A single-use pairing code from `authPairingCreate` (R3), with the QR text
/// built on this phone.
struct PairingCode: Identifiable, Equatable {
    let code: String
    let qrText: String
    let expiresAt: Date
    var id: String { code }

    @MainActor
    static func create(with session: ServerSession) async throws -> PairingCode {
        let body = try await session.call(purpose: "Pairing another phone makes a one-time code that signs it in.") {
            try await session.client.authPairingCreate().ok.body.json
        }
        return PairingCode(
            code: body.code,
            qrText: try PairingQRCode.text(url: body.qr.url, certSHA256: body.qr.certSha256, code: body.qr.code),
            expiresAt: Date(timeIntervalSince1970: body.expiresAt)
        )
    }
}

/// Shows the pairing QR code until it expires. The code signs a phone in,
/// so the sheet is covered whenever the app leaves the foreground.
struct PairPhoneSheet: View {
    @Environment(\.dismiss) private var dismiss
    let code: PairingCode
    let renew: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Pair another phone").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            Text("Open MyPetKit on the other phone and scan this code. It works once.")
                .font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
                .fixedSize(horizontal: false, vertical: true)
            SwiftUI.TimelineView(.periodic(from: .now, by: 1)) { context in
                let remaining = Int(code.expiresAt.timeIntervalSince(context.date).rounded(.down))
                if remaining > 0 {
                    live(remaining: remaining)
                } else {
                    expired
                }
            }
            Button("Done") { dismiss() }
                .font(Theme.Font.button)
                .foregroundStyle(Theme.Color.text)
                .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
        .privacyShielded()
    }

    private func live(remaining: Int) -> some View {
        VStack(spacing: 12) {
            if let image = PairingQRCode.image(for: code.qrText) {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 260)
                    .padding(12)
                    .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.hero))
                    .accessibilityLabel("Pairing QR code")
            }
            Text(code.code).font(Theme.Font.monoMedium).foregroundStyle(Theme.Color.text).textSelection(.enabled)
            Text("Expires in \(remaining / 60):\(String(format: "%02d", remaining % 60))")
                .font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
        }
        .frame(maxWidth: .infinity)
    }

    private var expired: some View {
        VStack(spacing: 12) {
            Text("This code has expired.").font(Theme.Font.bodyMedium).foregroundStyle(Theme.Color.text)
            Button("Make a new code") {
                dismiss()
                renew()
            }
            .buttonStyle(.primary)
        }
        .frame(maxWidth: .infinity, minHeight: 200)
    }
}

#if DEBUG
#Preview("Pair another phone") {
    Color.clear.sheet(isPresented: .constant(true)) {
        PairPhoneSheet(
            code: PairingCode(
                code: "K7Q2-9XPM",
                qrText: #"{"cert_sha256":"3fa9","code":"K7Q2-9XPM","url":"https://192.168.1.20:8443"}"#,
                expiresAt: .now.addingTimeInterval(300)
            ),
            renew: {}
        )
    }
}
#endif
