import AVFoundation
import Foundation
import UniformTypeIdentifiers

/// Feeds AVPlayer through a pinned URLSession.
///
/// AVPlayer loads `https` URLs on its own networking stack, which never asks a
/// URLSession delegate about server trust, so it cannot accept the install's
/// self-signed certificate. Rewriting the scheme to `mypetkit-https` makes
/// AVFoundation hand every byte-range request to this resource loader instead,
/// which fetches it over the pinned session with an HTTP `Range` header.
///
/// Every callback (resource loader and URLSession alike) runs on `queue`, one
/// serial queue, which is what makes the mutable task table safe.
public final class PinnedMediaLoader: NSObject, @unchecked Sendable {
    public static let scheme = "mypetkit-https"

    public let queue = DispatchQueue(label: "my-petkit.media-loader")
    private let pinDelegate: PinnedSessionDelegate
    private var session: URLSession!
    private var pending: [Int: AVAssetResourceLoadingRequest] = [:]

    public init(host: String, pin: CertificatePin) {
        pinDelegate = PinnedSessionDelegate(host: host, pin: pin)
        super.init()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.tlsMinimumSupportedProtocolVersion = .TLSv12
        let operations = OperationQueue()
        operations.underlyingQueue = queue
        operations.maxConcurrentOperationCount = 1
        session = URLSession(configuration: configuration, delegate: self, delegateQueue: operations)
    }

    deinit {
        session.invalidateAndCancel()
    }

    /// An asset for `url` (an `https` signed media URL) that loads through
    /// this loader. AVFoundation holds the loader weakly: keep `self` alive
    /// for as long as the asset plays.
    public func asset(for url: URL) -> AVURLAsset? {
        guard var parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "https"
        else { return nil }
        parts.scheme = Self.scheme
        guard let rewritten = parts.url else { return nil }
        let asset = AVURLAsset(url: rewritten)
        asset.resourceLoader.setDelegate(self, queue: queue)
        return asset
    }

    /// The `Range` header for a loading request, or nil for the whole resource.
    /// A request with only a content-information part asks for two bytes, the
    /// smallest read that still returns the type and total length.
    static func rangeHeader(
        offset: Int64, length: Int, toEnd: Bool, hasDataRequest: Bool
    ) -> String {
        guard hasDataRequest else { return "bytes=0-1" }
        if toEnd || length <= 0 { return "bytes=\(offset)-" }
        return "bytes=\(offset)-\(offset + Int64(length) - 1)"
    }

    /// The total length from `Content-Range: bytes a-b/total`, or from
    /// `Content-Length` on a whole-file 200.
    static func totalLength(of response: HTTPURLResponse) -> Int64? {
        if response.statusCode == 206 {
            guard let range = response.value(forHTTPHeaderField: "Content-Range"),
                  let slash = range.lastIndex(of: "/")
            else { return nil }
            return Int64(range[range.index(after: slash)...])
        }
        return response.expectedContentLength >= 0 ? response.expectedContentLength : nil
    }
}

extension PinnedMediaLoader: AVAssetResourceLoaderDelegate {
    public func resourceLoader(
        _ resourceLoader: AVAssetResourceLoader,
        shouldWaitForLoadingOfRequestedResource loadingRequest: AVAssetResourceLoadingRequest
    ) -> Bool {
        guard let url = loadingRequest.request.url,
              var parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == Self.scheme
        else { return false }
        parts.scheme = "https"
        guard let target = parts.url else { return false }

        let data = loadingRequest.dataRequest
        var request = URLRequest(url: target)
        request.setValue(
            Self.rangeHeader(
                offset: data?.requestedOffset ?? 0,
                length: data?.requestedLength ?? 0,
                toEnd: data?.requestsAllDataToEndOfResource ?? false,
                hasDataRequest: data != nil
            ),
            forHTTPHeaderField: "Range"
        )
        let task = session.dataTask(with: request)
        pending[task.taskIdentifier] = loadingRequest
        task.resume()
        return true
    }

    public func resourceLoader(
        _ resourceLoader: AVAssetResourceLoader,
        didCancel loadingRequest: AVAssetResourceLoadingRequest
    ) {
        guard let (id, _) = pending.first(where: { $0.value === loadingRequest }) else { return }
        pending[id] = nil
        session.getAllTasks { tasks in
            tasks.first { $0.taskIdentifier == id }?.cancel()
        }
    }
}

extension PinnedMediaLoader: URLSessionDataDelegate {
    public func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping @Sendable (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        let (disposition, credential) = pinDelegate.evaluate(challenge)
        completionHandler(disposition, credential)
    }

    public func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping @Sendable (URLSession.ResponseDisposition) -> Void
    ) {
        guard let loadingRequest = pending[dataTask.taskIdentifier] else {
            completionHandler(.cancel)
            return
        }
        guard let http = response as? HTTPURLResponse, http.statusCode == 206 || http.statusCode == 200 else {
            pending[dataTask.taskIdentifier] = nil
            loadingRequest.finishLoading(with: URLError(.badServerResponse))
            completionHandler(.cancel)
            return
        }
        // A 200 to a request that starts past byte 0 means the server ignored
        // the range; the bytes would land at the wrong offset.
        if http.statusCode == 200, (loadingRequest.dataRequest?.requestedOffset ?? 0) > 0 {
            pending[dataTask.taskIdentifier] = nil
            loadingRequest.finishLoading(with: URLError(.badServerResponse))
            completionHandler(.cancel)
            return
        }
        if let info = loadingRequest.contentInformationRequest {
            if let mime = http.mimeType, let type = UTType(mimeType: mime) {
                info.contentType = type.identifier
            }
            if let total = Self.totalLength(of: http) {
                info.contentLength = total
            }
            info.isByteRangeAccessSupported = http.statusCode == 206
                || http.value(forHTTPHeaderField: "Accept-Ranges") == "bytes"
        }
        if loadingRequest.dataRequest == nil {
            pending[dataTask.taskIdentifier] = nil
            loadingRequest.finishLoading()
            completionHandler(.cancel)
            return
        }
        completionHandler(.allow)
    }

    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        pending[dataTask.taskIdentifier]?.dataRequest?.respond(with: data)
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let loadingRequest = pending.removeValue(forKey: task.taskIdentifier) else { return }
        if let error {
            loadingRequest.finishLoading(with: error)
        } else {
            loadingRequest.finishLoading()
        }
    }
}
