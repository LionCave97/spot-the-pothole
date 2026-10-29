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
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.rememberCoroutineScope
import za.spotthepothole.app.auth.AuthSessionProvider
import za.spotthepothole.app.data.AuthRepository
import za.spotthepothole.app.spot.SpotUploadProgress
import za.spotthepothole.app.spot.SpotUploadRepository
import za.spotthepothole.app.validation.UsernameValidator
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

@Composable
fun MapScreen(strings: AppStrings) {
    ScreenScaffold(strings.mapTitle, strings.stubMessage)
}

@Composable
fun SpotScreen(
    strings: AppStrings,
    auth: AuthRepository,
    browseWithoutAccount: Boolean,
    authSessionProvider: AuthSessionProvider = AuthSessionProvider { null },
) {
    val profile by auth.profile.collectAsState()

    LaunchedEffect(Unit) {
        auth.refreshSession()
    }

    if (profile?.onboardingCompletedAt == null) {
        val message = when {
            profile == null -> strings.spotRequiresAuth
            else -> strings.finishSetup
        }
        ScreenScaffold(strings.spotTitle, message)
        return
    }

    val context = LocalContext.current
    var locationSample by remember { mutableStateOf<SpotLocationSample?>(null) }
    var gateMessage by remember { mutableStateOf(strings.spotWaitingForGps) }
    var captureEnabled by remember { mutableStateOf(false) }
    var previewError by remember { mutableStateOf<String?>(null) }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var captured by remember { mutableStateOf<CapturedSpotPhoto?>(null) }
    var potholeName by remember { mutableStateOf("") }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var isBusy by remember { mutableStateOf(false) }

    val uploadRepository = remember { SpotUploadRepository(authSessionProvider) }
    val scope = rememberCoroutineScope()

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

        if (captured != null) {
            OutlinedTextField(
                value = potholeName,
                onValueChange = { potholeName = it },
                label = { Text(strings.spotNameLabel) },
                placeholder = { Text(strings.spotNamePlaceholder) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
            )
            statusMessage?.let {
                Text(
                    text = it,
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Button(
                onClick = {
                    if (potholeName.isBlank()) {
                        statusMessage = strings.uploadNameRequired
                        return@Button
                    }
                    val photo = captured ?: return@Button
                    isBusy = true
                    statusMessage = strings.uploadBlurring
                    scope.launch {
                        val result = uploadRepository.submitSpot(photo, potholeName.trim()) { progress ->
                            statusMessage = when (progress) {
                                SpotUploadProgress.Blurring -> strings.uploadBlurring
                                is SpotUploadProgress.Uploading -> strings.uploadProgress
                                SpotUploadProgress.Submitting -> strings.uploadSubmitting
                                SpotUploadProgress.Done -> strings.uploadPendingModeration
                            }
                        }
                        isBusy = false
                        if (result.isSuccess) {
                            captured = null
                            potholeName = ""
                        } else {
                            val err = result.exceptionOrNull()
                            statusMessage = when (err?.message) {
                                "sign_in_required" -> strings.uploadSignInRequired
                                else -> if (statusMessage == strings.uploadBlurring) {
                                    strings.uploadBlurFailed
                                } else {
                                    strings.uploadFailed
                                }
                            }
                        }
                    }
                },
                enabled = !isBusy,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
            ) {
                Text(strings.spotSubmit)
            }
            Button(
                onClick = {
                    captured = null
                    statusMessage = null
                },
                enabled = !isBusy,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            ) {
                Text(strings.spotRetake)
            }
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
                            captured = CapturedSpotPhoto(stripped, loc)
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
fun ProfileScreen(
    strings: AppStrings,
    auth: AuthRepository,
    browseWithoutAccount: Boolean,
    onBrowseWithoutAccount: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val profile by auth.profile.collectAsState()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var isAnonymous by remember { mutableStateOf(false) }
    var consent by remember { mutableStateOf(false) }
    var onboardingStep by remember { mutableStateOf(0) }
    var message by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        auth.refreshSession()
    }

    LaunchedEffect(profile) {
        username = profile?.username.orEmpty()
        isAnonymous = profile?.isAnonymous == true
        if (profile != null && profile?.onboardingCompletedAt == null) {
            onboardingStep = 1
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        Text(text = strings.profileTitle, style = MaterialTheme.typography.headlineMedium)

        when {
            profile == null -> {
                Text(strings.spotRequiresAuth, modifier = Modifier.padding(top = 12.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text(strings.email) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text(strings.password) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                )
                Button(
                    onClick = {
                        scope.launch {
                            runCatching { auth.signIn(email, password) }
                                .onFailure { message = it.message.orEmpty() }
                        }
                    },
                    modifier = Modifier.padding(top = 8.dp),
                ) { Text(strings.signInAction) }
                Button(
                    onClick = {
                        scope.launch {
                            runCatching { auth.signUp(email, password) }
                                .onSuccess { message = strings.authCheckEmail }
                                .onFailure { message = it.message.orEmpty() }
                        }
                    },
                    modifier = Modifier.padding(top = 8.dp),
                ) { Text(strings.signUpAction) }
                Button(onClick = onBrowseWithoutAccount, modifier = Modifier.padding(top = 8.dp)) {
                    Text(strings.browseWithoutAccount)
                }
            }

            profile?.onboardingCompletedAt == null -> {
                Text(strings.onboardingTitle, modifier = Modifier.padding(top = 12.dp))
                if (onboardingStep == 1) {
                    Text(strings.consentCheckbox, modifier = Modifier.padding(top = 8.dp))
                    Checkbox(checked = consent, onCheckedChange = { consent = it })
                    Button(
                        enabled = consent,
                        onClick = { onboardingStep = 2 },
                    ) { Text(strings.onboardingContinue) }
                } else {
                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it },
                        label = { Text(strings.usernameLabel) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Checkbox(checked = isAnonymous, onCheckedChange = { isAnonymous = it })
                    Text(strings.anonymousLabel)
                    Button(
                        onClick = {
                            scope.launch {
                                val err = UsernameValidator.validate(username)
                                if (err != null) {
                                    message = err
                                    return@launch
                                }
                                runCatching {
                                    auth.completeOnboarding(UsernameValidator.normalize(username), isAnonymous)
                                    onboardingStep = 3
                                }.onFailure { message = it.message.orEmpty() }
                            }
                        },
                    ) { Text(strings.onboardingContinue) }
                }
                if (onboardingStep == 3) {
                    Text(strings.permissionsLead, modifier = Modifier.padding(top = 8.dp))
                    Text(strings.cameraReason)
                    Text(strings.locationReason)
                    Button(onClick = { onboardingStep = 0 }) { Text(strings.finishSetup) }
                }
            }

            else -> {
                Text(
                    text = if (profile?.isAnonymous == true) strings.anonymousSpotter else profile?.username.orEmpty(),
                    modifier = Modifier.padding(top = 12.dp),
                )
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text(strings.usernameLabel) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                )
                Checkbox(checked = isAnonymous, onCheckedChange = { isAnonymous = it })
                Text(strings.anonymousLabel)
                Button(onClick = { scope.launch { auth.signOut() } }, modifier = Modifier.padding(top = 8.dp)) {
                    Text(strings.signOut)
                }
                Button(
                    onClick = { scope.launch { runCatching { auth.deleteAccount() }.onFailure { message = it.message.orEmpty() } } },
                    modifier = Modifier.padding(top = 8.dp),
                ) { Text(strings.deleteAccount) }
            }
        }

        if (message.isNotBlank()) {
            Text(message, modifier = Modifier.padding(top = 12.dp))
        }
    }
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
