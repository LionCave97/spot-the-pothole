import AVFoundation
import SwiftUI
import UIKit

struct CapturedSpotPhoto {
    let jpegData: Data
    let location: SpotLocationSample
}

final class CameraCaptureCoordinator: ObservableObject {
    fileprivate weak var controller: CameraViewController?

    func capture() {
        controller?.capturePhoto()
    }
}

struct LiveCameraView: UIViewControllerRepresentable {
    @ObservedObject var coordinator: CameraCaptureCoordinator
    let isCaptureEnabled: Bool
    let onCaptured: (Data) -> Void

    func makeUIViewController(context: Context) -> CameraViewController {
        let controller = CameraViewController()
        controller.onCaptured = onCaptured
        controller.isCaptureEnabled = isCaptureEnabled
        coordinator.controller = controller
        return controller
    }

    func updateUIViewController(_ uiViewController: CameraViewController, context: Context) {
        uiViewController.isCaptureEnabled = isCaptureEnabled
        coordinator.controller = uiViewController
    }
}

final class CameraViewController: UIViewController, AVCapturePhotoCaptureDelegate {
    var onCaptured: ((Data) -> Void)?
    var isCaptureEnabled = false

    private let session = AVCaptureSession()
    private let photoOutput = AVCapturePhotoOutput()
    private var previewLayer: AVCaptureVideoPreviewLayer?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureSession()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    private func configureSession() {
        session.beginConfiguration()
        session.sessionPreset = .photo

        guard
            let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
            let input = try? AVCaptureDeviceInput(device: device),
            session.canAddInput(input),
            session.canAddOutput(photoOutput)
        else {
            return
        }

        session.addInput(input)
        session.addOutput(photoOutput)
        session.commitConfiguration()

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(layer)
        previewLayer = layer

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.session.startRunning()
        }
    }

    func capturePhoto() {
        guard isCaptureEnabled else { return }
        let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
        photoOutput.capturePhoto(with: settings, delegate: self)
    }

    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        guard error == nil, let data = photo.fileDataRepresentation() else { return }
        let stripped = JpegExifStripper.stripExif(from: data)
        onCaptured?(stripped)
    }
}

enum JpegExifStripper {
    /// Re-encodes JPEG without metadata; GPS/time are sent separately in the spot payload.
    static func stripExif(from data: Data) -> Data {
        guard let image = UIImage(data: data) else { return data }
        return image.jpegData(compressionQuality: 0.92) ?? data
    }
}
