package za.spotthepothole.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import za.spotthepothole.app.spot.CapturedSpotPhoto
import za.spotthepothole.app.spot.JpegExifStripper
import za.spotthepothole.app.spot.SpotCaptureBlockReason
import za.spotthepothole.app.spot.SpotCaptureGate
import za.spotthepothole.app.spot.SpotLocationSample
import za.spotthepothole.app.spot.SpotLocationTracker
import za.spotthepothole.app.ui.strings.AppStrings
import java.util.concurrent.Executors

@Composable
fun MapScreen(strings: AppStrings) {
    ScreenScaffold(strings.mapTitle, strings.stubMessage)
}

@Composable
fun SpotScreen(
    strings: AppStrings,
    onPhotoCaptured: (CapturedSpotPhoto) -> Unit = {},
) {
    val context = LocalContext.current
    var locationSample by remember { mutableStateOf<SpotLocationSample?>(null) }
    var gateMessage by remember { mutableStateOf(strings.spotWaitingForGps) }
    var captureEnabled by remember { mutableStateOf(false) }
    var previewError by remember { mutableStateOf<String?>(null) }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }

    val permissions = arrayOf(
        Manifest.permission.CAMERA,
        Manifest.permission.ACCESS_FINE_LOCATION,
    )

    var permissionsGranted by remember {
        mutableStateOf(
            permissions.all {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            },
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { result ->
        permissionsGranted = result.values.all { it }
    }

    LaunchedEffect(permissionsGranted) {
        if (!permissionsGranted) {
            permissionLauncher.launch(permissions)
        }
    }

    val tracker = remember { SpotLocationTracker(context) }
    val captureExecutor = remember { Executors.newSingleThreadExecutor() }

    DisposableEffect(permissionsGranted) {
        if (permissionsGranted) {
            tracker.start { sample ->
                locationSample = sample
                val gate = SpotCaptureGate.evaluate(sample)
                captureEnabled = gate.allowed
                gateMessage = when (gate.reason) {
                    SpotCaptureBlockReason.SPEED -> strings.spotSpeedTooFast
                    SpotCaptureBlockReason.ACCURACY -> strings.spotGpsAccuracyPoor
                    SpotCaptureBlockReason.NO_LOCATION -> strings.spotWaitingForGps
                    null -> strings.spotCaptureReady
                }
            }
        }
        onDispose {
            tracker.stop()
            captureExecutor.shutdown()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Text(
            text = strings.spotTitle,
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.padding(16.dp),
        )
        Text(
            text = strings.spotCameraHint,
            modifier = Modifier.padding(horizontal = 16.dp),
        )
        Text(
            text = gateMessage,
            color = if (captureEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp),
        )

        if (!permissionsGranted) {
            Text(
                text = strings.spotCameraPermissionDenied,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            return@Column
        }

        Box(modifier = Modifier.weight(1f)) {
            LiveCameraPreview(
                onImageCaptureReady = { imageCapture = it },
                onError = { previewError = it },
            )
            previewError?.let {
                Text(
                    text = it,
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(8.dp),
                )
            }
        }

        Button(
            onClick = {
                val capture = imageCapture ?: return@Button
                capture.takePicture(
                    captureExecutor,
                    object : ImageCapture.OnImageCapturedCallback() {
                        override fun onCaptureSuccess(image: androidx.camera.core.ImageProxy) {
                            val buffer = image.planes[0].buffer
                            val bytes = ByteArray(buffer.remaining())
                            buffer.get(bytes)
                            image.close()
                            val loc = locationSample ?: return
                            val stripped = JpegExifStripper.stripExif(bytes)
                            onPhotoCaptured(CapturedSpotPhoto(stripped, loc))
                        }

                        override fun onError(exception: ImageCaptureException) {
                            previewError = exception.message ?: strings.errorsGeneric
                        }
                    },
                )
            },
            enabled = captureEnabled,
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            Text(strings.spotCapture)
        }
    }
}

@Composable
private fun LiveCameraPreview(
    onImageCaptureReady: (ImageCapture) -> Unit,
    onError: (String) -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            PreviewView(ctx).apply {
                scaleType = PreviewView.ScaleType.FILL_CENTER
            }
        },
        update = { previewView ->
            val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
            cameraProviderFuture.addListener({
                val cameraProvider = cameraProviderFuture.get()
                val preview = Preview.Builder().build().also {
                    it.surfaceProvider = previewView.surfaceProvider
                }
                val capture = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                    .build()
                onImageCaptureReady(capture)
                try {
                    cameraProvider.unbindAll()
                    cameraProvider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        capture,
                    )
                } catch (e: Exception) {
                    onError(e.message ?: "Camera failed")
                }
            }, ContextCompat.getMainExecutor(context))
        },
    )
}

@Composable
fun PotholeDetailScreen(strings: AppStrings, potholeId: String?) {
    ScreenScaffold("Pothole", "Detail for $potholeId — ${strings.stubMessage}")
}

@Composable
fun LeaderboardScreen(strings: AppStrings) {
    ScreenScaffold(strings.navLeaderboard, strings.stubMessage)
}

@Composable
fun ProfileScreen(strings: AppStrings) {
    ScreenScaffold(strings.profileTitle, strings.stubMessage)
}

@Composable
private fun ScreenScaffold(title: String, body: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        Text(text = title, style = MaterialTheme.typography.headlineMedium)
        Text(text = body, modifier = Modifier.padding(top = 12.dp))
    }
}
