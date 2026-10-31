import Foundation
import PetkitAPI

/// The state of one block of data on a screen. Each block loads, fails and
/// retries on its own, so one failing call never blanks the whole screen.
enum Loadable<Value> {
    case loading
    case loaded(Value)
    case failed(String)

    var value: Value? {
        if case .loaded(let value) = self { return value }
        return nil
    }

    /// The sentence shown inside the block for `error`.
    static func message(for error: any Error) -> String {
        if let api = APIError.from(error) { return api.message }
        // The generated client wraps transport failures in ClientError.
        let underlying = (error as? ClientError)?.underlyingError ?? error
        if let url = underlying as? URLError {
            switch url.code {
            case .notConnectedToInternet, .cannotConnectToHost, .timedOut, .networkConnectionLost,
                 .cannotFindHost:
                return L10n.string("The server did not answer.")
            case .cancelled, .secureConnectionFailed, .serverCertificateUntrusted:
                return L10n.string("The server's certificate is not the one this phone paired with.")
            default: break
            }
        }
        return L10n.string("Something went wrong. Try again.")
    }
}

extension Loadable: Sendable where Value: Sendable {}
