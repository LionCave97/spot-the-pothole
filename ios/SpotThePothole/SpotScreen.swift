import AVFoundation
import SwiftUI

struct SpotScreen: View {
    @StateObject private var locationService = SpotLocationService()
    @StateObject private var cameraCoordinator = CameraCaptureCoordinator()
    @State private var gateMessage = L10n.spotWaitingForGps
    @State private var captureEnabled = false
    @State private var cameraAuthorized = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text(L10n.spotTitle).font(.largeTitle.bold())
                Text(L10n.spotCameraHint).foregroundStyle(.secondary)
                Text(gateMessage)
                    .foregroundStyle(captureEnabled ? Color.green : Color.red)
                    .font(.callout)

                if cameraAuthorized {
                    LiveCameraView(
                        coordinator: cameraCoordinator,
                        isCaptureEnabled: captureEnabled
                    ) { _ in
                        // DEV-202 adds blur, upload, and spot submission.
                    }
                    .frame(maxHeight: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    Button(L10n.spotCapture) {
                        cameraCoordinator.capture()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!captureEnabled)
                } else {
                    Text(L10n.spotCameraPermissionDenied)
                }

                Spacer()
            }
            .padding()
            .navigationTitle(L10n.spot)
            .onAppear {
                locationService.requestAuthorizationAndStart()
                requestCameraAccess()
            }
            .onDisappear {
                locationService.stop()
            }
            .onReceive(locationService.$latest) { sample in
                let gate = SpotCaptureGate.evaluate(location: sample)
                captureEnabled = gate.allowed
                gateMessage = switch gate.reason {
                case .speed: L10n.spotSpeedTooFast
                case .accuracy: L10n.spotGpsAccuracyPoor
                case .noLocation: L10n.spotWaitingForGps
                case nil: L10n.spotCaptureReady
                }
            }
        }
    }

    private func requestCameraAccess() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            cameraAuthorized = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async { cameraAuthorized = granted }
            }
        default:
            cameraAuthorized = false
        }
    }
}
