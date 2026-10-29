@preconcurrency import AVFoundation
import SwiftUI
import UIKit

/// The camera, reporting the first QR code it reads. Shows nothing (the
/// caller's dark card) when there is no camera, as on the Simulator, or when
/// access was refused.
struct QRScannerView: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    func makeUIViewController(context: Context) -> ScannerController {
        let controller = ScannerController()
        controller.onCode = onCode
        return controller
    }

    func updateUIViewController(_ controller: ScannerController, context: Context) {
        controller.onCode = onCode
    }

    static var isAvailable: Bool {
        AVCaptureDevice.default(for: .video) != nil
            && AVCaptureDevice.authorizationStatus(for: .video) != .denied
    }
}

final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onCode: ((String) -> Void)?
    private let capture = AVCaptureSession()
    private var preview: AVCaptureVideoPreviewLayer?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        guard let camera = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: camera),
              capture.canAddInput(input)
        else { return }
        capture.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard capture.canAddOutput(output) else { return }
        capture.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]
        let layer = AVCaptureVideoPreviewLayer(session: capture)
        layer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(layer)
        preview = layer
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let capture = capture
        DispatchQueue.global(qos: .userInitiated).async { capture.startRunning() }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        capture.stopRunning()
    }

    nonisolated func metadataOutput(
        _ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection
    ) {
        let text = (objects.first as? AVMetadataMachineReadableCodeObject)?.stringValue
        MainActor.assumeIsolated {
            if let text { onCode?(text) }
        }
    }
}
