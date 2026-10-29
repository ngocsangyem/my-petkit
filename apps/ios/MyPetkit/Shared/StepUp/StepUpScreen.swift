import PetkitAPI
import PetkitCore
import SwiftUI

/// The shared R3 re-authentication screen. Every step-up row and every call
/// that the server refuses with `step_up_required` lands here. The server
/// says nothing about tries left, only `Retry-After` once it has locked, so
/// the wait is shown and the count is not.
struct StepUpScreen: View {
    @Environment(ServerSession.self) private var session
    let request: StepUpRequest

    @State private var password = ""
    @State private var error: String?
    @State private var busy = false
    @State private var lockedUntil: Date?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.gap) {
            HStack {
                IconButton(systemImage: "chevron.left", label: "Cancel") { finish(false) }
                Spacer()
                Pill(text: "Step-up required", tone: .negative)
            }
            Text("Confirm it's you").font(Theme.Font.title).accessibilityAddTraits(.isHeader)
            Text(request.purpose).font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
            Card {
                VStack(spacing: 8) {
                    Image(systemName: "lock")
                        .font(Theme.Font.iconLarge)
                        .frame(width: 64, height: 64)
                        .background(Theme.Color.raised, in: Circle())
                        .accessibilityHidden(true)
                    Text("admin").font(Theme.Font.section)
                    Text(session.serverName).font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                }
                .frame(maxWidth: .infinity)
            }
            Card {
                LabeledField(label: "Password", footnote: footnote) {
                    SecureField("", text: $password)
                        .textContentType(.password)
                        .focused($focused)
                        .submitLabel(.go)
                        .onSubmit(confirm)
                }
                if let error {
                    Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
                }
            }
            Spacer()
            Button(action: confirm) {
                if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Confirm") }
            }
            .buttonStyle(.primary)
            .disabled(password.isEmpty || busy || isLocked)
            Button("Cancel") { finish(false) }
                .font(Theme.Font.button)
                .foregroundStyle(Theme.Color.text)
                .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
        }
        .padding(Theme.Space.screenEdge)
        .background(Theme.Color.ground.ignoresSafeArea())
        .onAppear { focused = true }
        .privacyShielded()
    }

    private var isLocked: Bool { lockedUntil.map { $0 > .now } ?? false }

    private var footnote: String {
        if let lockedUntil, lockedUntil > .now {
            let seconds = Int(lockedUntil.timeIntervalSinceNow.rounded(.up))
            return "Too many tries. Wait \(seconds) seconds."
        }
        return "Valid for 5 minutes, for this phone only."
    }

    private func confirm() {
        guard !password.isEmpty, !busy, !isLocked else { return }
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                _ = try await session.client.authStepUp(body: .json(.init(password: password))).ok
                finish(true)
            } catch {
                password = ""
                let api = APIError.from(error)
                if let wait = api?.retryAfter {
                    lockedUntil = .now.addingTimeInterval(TimeInterval(wait))
                    self.error = nil
                } else {
                    self.error = api?.status == 401 ? "That password is not right." : Loadable<Void>.message(for: error)
                }
            }
        }
    }

    private func finish(_ granted: Bool) {
        request.finish(granted: granted)
        if session.stepUp === request { session.stepUp = nil }
    }
}
