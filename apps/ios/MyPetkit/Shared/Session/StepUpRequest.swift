import Foundation

/// One pending "re-enter your password" prompt. The R3 call that hit
/// `step_up_required` waits on it; the shared `StepUpScreen` resolves it.
@MainActor
final class StepUpRequest: Identifiable {
    let id = UUID()
    /// What the user is about to do, shown under the title.
    let purpose: String
    private var continuation: CheckedContinuation<Bool, Never>?

    init(purpose: String, continuation: CheckedContinuation<Bool, Never>) {
        self.purpose = purpose
        self.continuation = continuation
    }

    func finish(granted: Bool) {
        continuation?.resume(returning: granted)
        continuation = nil
    }
}
