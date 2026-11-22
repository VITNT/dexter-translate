import { HandLandmarker, PoseLandmarker, FilesetResolver }
    from "@mediapipe/tasks-vision";
import {
    normalizeRgbBytes,
    uniformSampleIndices,
    validateWlaslManifest
} from "../src/pipeline/wlasl_video_pipeline.mjs";
import {
    buildHandSignature,
    copyHandSignature,
    handSignatureDistance,
    normalizeHandShapeSignature,
    updatePauseProgress,
    updateReleaseProgress
} from "../src/pipeline/signing_release.mjs";
import {
    predictStaticCsl,
    validateStaticCslModel
} from "../src/pipeline/csl_static_classifier.mjs";
import {
    buildCadtCslHandFrame,
    interpolateCadtCslFrame,
    prepareCadtCslSequence
} from "../src/pipeline/csl_cadt_word_pipeline.mjs";
import {
    getAslDynamicLetterIntent,
    hasEmergingAslLetterMotion
} from "../src/pipeline/asl_letter_motion.mjs";
import {
    classifyClosedThumbLetter,
    hasCrossedIndexMiddle
} from "../src/pipeline/asl_static_geometry.mjs";
import {
    appendCommonAslFrame,
    detectCommonAslWord
} from "../src/pipeline/asl_common_words.mjs";
import {
    hasVisibleHandLandmarks,
    shouldSubmitAslWordClip
} from "../src/pipeline/word_hand_presence.mjs";
import { hasSufficientTopTwoMargin } from "../src/pipeline/prediction_rejection.mjs";
import {
    averageProbabilityVectors,
    findStaticAgreement,
    resolveCslRuntimeConfig,
    selectShiftedWindows
} from "../src/pipeline/csl_runtime_strategy.mjs";

// A fresh instance is bound on every mount, including client-side navigation.
export function mountTranslator() {
const listeners = new AbortController();
let disposed = false;
let animationFrame = null;
let startingCamera = false;
let modeGeneration = 0;
let translationInFlight = false;

// skip drawing skeletons on phones — they can't handle it
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let shouldDrawSkeletons = !isMobileDevice;

// camera stuff
let cameraStream;
let webcamVideo = document.getElementById('webcamFeed');
let webcamContainer = webcamVideo.closest('.video-container');
let cameraToggleBtn = document.getElementById('cameraBtn');
let pauseToggleBtn = document.getElementById('pauseBtn');
let activeCameraFacing = "user";
let isDetecting = false;
let currentTrackingMode = "asl_letter";
let lastDetectionAt = 0;

// UI elements we update constantly during detection
let rawExtractionDisplay = document.getElementById('liveOutput');
let confidenceProgressBar = document.getElementById('confidenceBar');
let confidencePctDisplay = document.getElementById('confidencePct');
let guessLabelDisplay = document.getElementById('guessLabel');
let sentenceBuilderDisplay = document.getElementById('builtSentence');
let translationStatusDisplay = document.getElementById('translationStatus');
let bilingualTranslationDisplay = document.getElementById('bilingualTranslation');
let khmerTranslationDisplay = document.getElementById('khmerTranslation');
let englishTranslationDisplay = document.getElementById('englishTranslation');
let speechLanguageSelect = document.getElementById('speechLanguageSelect');
let speakTranslationButton = document.getElementById('speakTranslationBtn');
let speechStatusDisplay = document.getElementById('speechStatus');
let captureGuide = document.getElementById('captureGuide');
let captureStateLabel = document.getElementById('captureStateLabel');
let captureStateDetail = document.getElementById('captureStateDetail');
let captureProgressTrack = document.getElementById('captureProgressTrack');
let captureProgressBar = document.getElementById('captureProgressBar');
let captureCountdown = document.getElementById('captureCountdown');
let captureCountdownNumber = document.getElementById('captureCountdownNumber');

// mediapipe hand + pose trackers
let handTracker;
let poseTracker;
let visionFileset;

// We retain the historical `csl` filenames for compatibility with existing
// Cambodian/Khmer assets while presenting the language as CSL in the UI.
let aslModel, aslWordModel, cslModel;
let cslStaticModel = null;
let latestCslStaticHands = [];
let wlaslModel = null;
let wlaslConfig = null;
let wlaslBackendReady = false;
let wlaslRecorder = null;
let wlaslRecorderStream = null;
let wlaslRecorderChunks = [];
let wlaslCaptureTimer = null;
let wlaslCaptureStartedAt = null;
let wlaslRequestInFlight = false;
let wlaslPendingClip = null;
let wlaslCaptureGeneration = 0;
let wlaslTrackedHandFrames = 0;
let aslModelMetadata = null;
let aslWordModelMetadata = null;
let cslModelMetadata = null;
let aslVocab = [], aslWordVocab = [], cslVocab = [];

// whichever model is selected right now
let activeAIModel;
let activeVocabulary = [];
let activeModelMetadata = null;

// Wrist motion remains useful to tune the optional legacy ASL landmark model.
let wristVelocityBuffer = [];
let routingWristHistory = { Left: [], Right: [] };

// The CADT CSL model and the small ASL motion model both use 30 frames.
let motionBuffer = [];
let cadtCslHandBuffer = [];
let cslCaptureEvaluationComplete = false;
let cadtCslLastObservedFrame = null;
let cadtCslLastObservedAt = null;
let cadtCslNextSampleAt = null;
let cslHandLossStartedAt = null;
let cslHandLossResetComplete = false;
let lastCslTopGuessDiagnostic = null;
let motionTimestampBuffer = [];
let wlaslFrameBuffer = [];
let commonAslWordFrames = [];
let lastWlaslInferenceAt = 0;
let accumulatedWord = "";
let previousVideoTime = -1;
const LEGACY_REQUIRED_FRAMES = 30;
const REQUIRED_FRAMES = LEGACY_REQUIRED_FRAMES;
const CONFIDENCE_THRESHOLD = 0.90;
const CSL_STATIC_CONFIDENCE_THRESHOLD = 0.75;
let wlaslApiUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://127.0.0.1:8001'
    : '';
// Match the checkpoint's 64-frame window at the 25 FPS used by WLASL clips.
const WLASL_RECORDING_SIZE = 256;
const WLASL_RECORDING_FPS = 25;
const WLASL_CLIP_WINDOW_MS = 2560;
const WLASL_BACKEND_CONFIDENCE = 0.55;
const MIN_CAPTURE_HAND_CONFIDENCE = 0.65;
// Keep phone inference at the existing 15 FPS budget even though the visible
// camera feed requests more pixels and a smoother preview.
const MOBILE_DETECTION_INTERVAL_MS = 1000 / 15;
const CSL_CAPTURE_SAMPLE_INTERVAL_MS = 1000 / 30;
const CSL_HAND_LOSS_GRACE_MS = 350;
const STATIC_HOLD_DURATION_MS = 260;
const STATIC_HOLD_MAX_TICK_MS = 100;
const STATIC_HOLD_DECAY_RATE = 0.35;
const STATIC_PREVIEW_REVEAL_PROGRESS = 0.35;
// Give people a consistent half-second to react after recognition before the
// camera is ready to accept another sign.
const RECOGNITION_REACTION_DELAY_MS = 500;
const CAPTURE_COUNTDOWN_START = 3;
const CAPTURE_COUNTDOWN_STEP_MS = 300;
const STATIC_RELEASE_DURATION_MS = 160;
const STATIC_RELEASE_SHAPE_THRESHOLD = 0.12;
const DYNAMIC_LETTER_REQUIRED_HITS = 4;
const DYNAMIC_LETTER_RELEASE_DURATION_MS = 160;
const DYNAMIC_REARM_PAUSE_MS = RECOGNITION_REACTION_DELAY_MS;
const DYNAMIC_REARM_MAX_TICK_MS = 100;
const DYNAMIC_REARM_STILL_VELOCITY = 0.12;

const wlaslCaptureCanvas = document.createElement('canvas');
const wlaslCaptureContext = wlaslCaptureCanvas.getContext('2d', { willReadFrequently: true });
const wlaslRecordingCanvas = document.createElement('canvas');
const wlaslRecordingContext = wlaslRecordingCanvas.getContext('2d', { alpha: false });
wlaslRecordingCanvas.width = WLASL_RECORDING_SIZE;
wlaslRecordingCanvas.height = WLASL_RECORDING_SIZE;

// how many frames in a row the same sign has been detected
let dynamicSignStreak = 0;
let lastDynamicGuess = "";
let staticSignStreak = 0;
let lastStaticGuess = "";
let staticHoldElapsedMs = 0;
let staticHoldLastTickAt = null;
let staticLetterVotes = [];
let staticAwaitingRelease = false;
let acceptedStaticLetter = "";
let acceptedStaticSignature = [];
let staticReleaseStartedAt = null;
let wordAwaitingRelease = false;
let acceptedWordLabel = "";
let acceptedWordRequiresShapeChange = false;
let acceptedWordSignature = [];
let dynamicLetterAwaitingRelease = false;
let acceptedDynamicLetter = "";
let acceptedDynamicSignature = [];
let dynamicLetterReleaseElapsedMs = 0;
let dynamicLetterReleaseLastTickAt = null;
let dynamicPauseElapsedMs = 0;
let dynamicPauseLastTickAt = null;
let dynamicPauseLastSignature = [];
let latestHandSignature = [];
let captureIsActive = false;
let captureCountdownTimer = null;
let captureCountdownGeneration = 0;
let latestHandsVisible = false;
let letterSessionCountdownComplete = false;
const VOTE_WINDOW = 5;
let predictionVotes = [];

// the transparent canvas sitting on top of the video for drawing skeletons
const overlayCanvasElement = document.getElementsByClassName('overlayCanvas')[0];
const canvasContext = overlayCanvasElement.getContext('2d');

// shorthand for fingerpose's finger names
const { Thumb, Index, Middle, Ring, Pinky } = fp.Finger;
const { NoCurl, HalfCurl, FullCurl } = fp.FingerCurl;

// hand shapes for each letter — fingerpose matches against these
const alphabetGestures = [
    buildSign('A', [Thumb], [], [Index, Middle, Ring, Pinky]),
    buildSign('B', [Index, Middle, Ring, Pinky], [Thumb], []),
    buildSign('C', [], [Thumb, Index, Middle, Ring, Pinky], []),
    buildSign('D', [Index], [Thumb], [Middle, Ring, Pinky]),
    buildSign('E', [], [], [Thumb, Index, Middle, Ring, Pinky]),
    buildSign('F', [Middle, Ring, Pinky], [Thumb, Index], []),
    buildSign('G', [Index], [Thumb], [Middle, Ring, Pinky]),
    buildSign('H', [Index, Middle], [Thumb], [Ring, Pinky]),
    buildSign('I', [Pinky], [], [Thumb, Index, Middle, Ring]),
    buildSign('K', [Index, Middle], [Thumb], [Ring, Pinky]),
    buildSign('L', [Thumb, Index], [], [Middle, Ring, Pinky]),
    buildSign('M', [], [Thumb], [Index, Middle, Ring, Pinky]),
    buildSign('N', [], [Thumb], [Index, Middle, Ring, Pinky]),
    buildSign('O', [], [Thumb, Index, Middle, Ring, Pinky], []),
    buildSign('P', [Index, Middle], [Thumb], [Ring, Pinky]),
    buildSign('Q', [Index], [Thumb], [Middle, Ring, Pinky]),
    buildSign('R', [Index, Middle], [], [Thumb, Ring, Pinky]),
    buildSign('S', [], [], [Thumb, Index, Middle, Ring, Pinky]),
    buildSign('T', [], [], [Thumb, Index, Middle, Ring, Pinky]),
    buildSign('U', [Index, Middle], [], [Thumb, Ring, Pinky]),
    buildSign('V', [Index, Middle], [], [Thumb, Ring, Pinky]),
    buildSign('W', [Index, Middle, Ring], [], [Thumb, Pinky]),
    buildSign('X', [], [Index], [Thumb, Middle, Ring, Pinky]),
    buildSign('Y', [Thumb, Pinky], [], [Index, Middle, Ring])
];
const gestureEstimator = new fp.GestureEstimator(alphabetGestures);

// which joints to connect when drawing the skeleton overlay
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
];
const POSE_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
    [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]
];

async function initializeMediaPipe() {
    try {
        await tf.setBackend('webgl');
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
        tf.env().set('WEBGL_PACK', true);
        tf.enableProdMode();
    } catch (error) {
        console.warn("WebGL initialization failed, falling back to the default TensorFlow backend.", error);
    }

    visionFileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");

    const aslLoading = loadAslModel();
    handTracker = await HandLandmarker.createFromOptions(visionFileset, {
        baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
        runningMode: "VIDEO",
        // Configure word modes only after their required models are loaded.
        numHands: 1,
        minHandDetectionConfidence: MIN_CAPTURE_HAND_CONFIDENCE,
        minHandPresenceConfidence: MIN_CAPTURE_HAND_CONFIDENCE,
        minTrackingConfidence: 0.5
    });

    await aslLoading;
}

async function loadAslModel() {
    try {
        const aslResponse = await fetch('./asl-labels.json');
        aslVocab = await aslResponse.json();
        aslModel = await tf.loadLayersModel('./asl-model.json');
        aslModelMetadata = null; // The shipped spelling bundle has no metadata file.
        validateModelBundle(aslModel, aslVocab, 'ASL');

        activeAIModel = aslModel;
        activeVocabulary = aslVocab;
        activeModelMetadata = aslModelMetadata;
        console.log("ASL model loaded successfully.");
    } catch (error) {
        console.error("Failed to load the ASL model. Check the filenames and paths.", error);
    }

}

async function loadAslWordModels() {
    try {
        const manifestResponse = await fetch('./models/asl/wlasl/manifest.json', { signal: AbortSignal.timeout(3000) });
        if (manifestResponse.ok) {
            const manifest = await manifestResponse.json();
            if (manifest.enabled) {
                wlaslConfig = validateWlaslManifest(manifest);
                const labelsResponse = await fetch(`./${wlaslConfig.labelsPath}`);
                if (!labelsResponse.ok) throw new Error(`Unable to load ${wlaslConfig.labelsPath}.`);
                aslWordVocab = await labelsResponse.json();
                wlaslModel = await tf.loadLayersModel(`./${wlaslConfig.modelPath}`);
                validateWlaslModelBundle(wlaslModel, aslWordVocab, wlaslConfig);
                aslWordModel = wlaslModel;
                aslWordModelMetadata = { ...wlaslConfig, adapter: 'wlasl_rgb_video' };
                console.log(`WLASL ${wlaslConfig.subset || ''} video model loaded successfully.`);
            }
        }
    } catch (error) {
        console.error("WLASL bundle is enabled but could not be loaded.", error);
    }

    if (!wlaslModel) {
        try {
            const aslWordResponse = await fetch('./asl_word_labels.json', { signal: AbortSignal.timeout(3000) });
            if (aslWordResponse.ok) {
                aslWordVocab = await aslWordResponse.json();
                aslWordModel = await tf.loadLayersModel('./asl_word_model.json');
                aslWordModelMetadata = await loadOptionalJson('./asl_word_model_metadata.json');
                validateModelBundle(aslWordModel, aslWordVocab, 'ASL Words');
                console.log("ASL word model loaded successfully.");
            }
        } catch (error) {
            console.log("No ASL word model installed; ASL Spelling remains available.");
        }
    }

}

async function loadCslModels() {
    try {
        const [labelsResponse, metadataResponse] = await Promise.all([
            fetch('./models/csl/cadt-word-v1/labels.json'),
            fetch('./models/csl/cadt-word-v1/metadata.json')
        ]);
        if (!labelsResponse.ok || !metadataResponse.ok) throw new Error('CADT CSL model manifest is incomplete.');
        cslVocab = await labelsResponse.json();
        cslModelMetadata = await metadataResponse.json();
        cslModel = await tf.loadLayersModel('./models/csl/cadt-word-v1/model.json');
        validateModelBundle(cslModel, cslVocab, 'CADT CSL words');
        console.log(`CADT CSL whole-word model loaded with ${cslVocab.length} classes.`);
    } catch (error) {
        console.error("CADT CSL whole-word model is unavailable.", error);
    }

    try {
        const staticResponse = await fetch('./models/csl/static-landmark-v1.json');
        if (!staticResponse.ok) throw new Error(`HTTP ${staticResponse.status}`);
        cslStaticModel = validateStaticCslModel(await staticResponse.json());
        console.log(`Static CSL fallback loaded with ${cslStaticModel.classes.length} form classes.`);
    } catch (error) {
        console.log("Static CSL fallback is not installed.", error);
    }

    if (!cslModel && !cslStaticModel) throw new Error("CSL recognition could not load. Please try again.");
}

const modeLoads = new Map();
function loadModeModels(mode) {
    if (!modeLoads.has(mode)) {
        const loading = mode === "csl_word" ? loadCslModels()
            : mode === "asl_word" ? Promise.all([loadAslWordModels(), ensurePoseTracker()])
            : Promise.resolve();
        modeLoads.set(mode, loading.catch(error => {
            modeLoads.delete(mode);
            throw error;
        }));
    }
    return modeLoads.get(mode);
}

let trackerHandCount = 1;
let modeConfiguration = Promise.resolve();
function configureSelectedMode() {
    modeConfiguration = modeConfiguration.catch(() => {}).then(async () => {
        await ensureModelsReady();
        let mode;
        do {
            mode = currentTrackingMode;
            await loadModeModels(mode);
            if (disposed) return;
        } while (mode !== currentTrackingMode);
        const count = mode === "asl_letter" ? 1 : 2;
        if (trackerHandCount !== count) {
            await handTracker.setOptions({ numHands: count });
            trackerHandCount = count;
        }
        activeAIModel = mode === "csl_word" ? cslModel : mode === "asl_word" ? aslWordModel : aslModel;
        activeVocabulary = mode === "csl_word" ? cslVocab : mode === "asl_word" ? aslWordVocab : aslVocab;
        activeModelMetadata = mode === "csl_word" ? cslModelMetadata : mode === "asl_word" ? aslWordModelMetadata : aslModelMetadata;
        if (mode === "asl_word") void refreshWordBackend();
    });
    return modeConfiguration;
}

async function refreshWordBackend() {
    await loadRuntimeConfig();
    await checkWlaslBackend();
    if (!disposed && currentTrackingMode === "asl_word") {
        rawExtractionDisplay.innerText = getAslWordRuntimeLabel();
        if (isDetecting && wlaslBackendReady) startWlaslCaptureLoop();
    }
}

async function ensurePoseTracker() {
    if (poseTracker) return poseTracker;
    if (!visionFileset) throw new Error("MediaPipe is not initialized yet.");
    poseTracker = await PoseLandmarker.createFromOptions(visionFileset, {
        baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`, delegate: "GPU" },
        runningMode: "VIDEO"
    });
    return poseTracker;
}

function currentModeNeedsPoseTracker() {
    // Face and shoulder anchors make the local Hello motion rule independent
    // of camera position. Legacy 225-value word models need the same pose data.
    return currentTrackingMode === "asl_word";
}

function getAslWordRuntimeLabel() {
    return (wlaslBackendReady || aslWordModel)
        ? "[ASL geometry + WLASL]"
        : "[ASL geometry: Hello, OK, I love you]";
}

async function loadRuntimeConfig() {
    try {
        const response = await fetch('/api/config', { signal: AbortSignal.timeout(3000) });
        if (!response.ok) return;
        const config = await response.json();
        const configuredUrl = String(config?.wlaslApiUrl || '').trim().replace(/\/+$/, '');
        if (/^https?:\/\//i.test(configuredUrl) || configuredUrl.startsWith('/')) {
            wlaslApiUrl = configuredUrl;
        }
    } catch (error) {
        // A plain static server has no /api/config route. Keep the localhost
        // fallback so recognition still works during simple local development.
    }
}

async function checkWlaslBackend() {
    if (!wlaslApiUrl) {
        wlaslBackendReady = false;
        return false;
    }
    try {
        const response = await fetch(`${wlaslApiUrl}/health`, { signal: AbortSignal.timeout(3000) });
        const status = response.ok ? await response.json() : null;
        wlaslBackendReady = status?.status === 'ready' && status?.classes === 300;
    } catch (error) {
        wlaslBackendReady = false;
    }
    return wlaslBackendReady;
}

async function loadOptionalJson(path) {
    try {
        const response = await fetch(path);
        return response.ok ? await response.json() : null;
    } catch (error) {
        console.warn(`Optional model metadata was not available at ${path}.`, error);
        return null;
    }
}

function validateModelBundle(model, labels, displayName) {
    const outputCount = model?.outputs?.[0]?.shape?.at(-1);
    if (!Array.isArray(labels) || labels.length === 0) {
        throw new Error(`${displayName} has no labels.`);
    }
    if (Number.isFinite(outputCount) && outputCount !== labels.length) {
        throw new Error(
            `${displayName} model outputs ${outputCount} classes but its label file contains ${labels.length}.`
        );
    }
}

function validateWlaslModelBundle(model, labels, config) {
    validateModelBundle(model, labels, 'WLASL');
    const shape = model?.inputs?.[0]?.shape;
    const expected = [null, config.frameCount, config.imageSize, config.imageSize, 3];
    if (!shape || shape.length !== 5 || expected.slice(1).some((value, index) => shape[index + 1] !== value)) {
        throw new Error(`WLASL model input must be [batch, ${expected.slice(1).join(', ')}].`);
    }
}

// Retry failed initialization instead of retaining a rejected startup promise.
let modelInitPromise;
function ensureModelsReady() {
    if (!modelInitPromise) {
        modelInitPromise = initializeMediaPipe().catch(error => {
            handTracker?.close();
            handTracker = null;
            modelInitPromise = null;
            throw error;
        });
    }
    return modelInitPromise;
}

function buildSign(name, noCurls, halfCurls, fullCurls) {
    const sign = new fp.GestureDescription(name);
    noCurls.forEach(finger => sign.addCurl(finger, NoCurl, 1.0));
    halfCurls.forEach(finger => sign.addCurl(finger, HalfCurl, 1.0));
    fullCurls.forEach(finger => sign.addCurl(finger, FullCurl, 1.0));
    return sign;
}

function evaluateFingerPose(handLandmarks) {
    const keypoints3D = handLandmarks.map(pt => [
        pt.x * overlayCanvasElement.width,
        pt.y * overlayCanvasElement.height,
        pt.z * overlayCanvasElement.width
    ]);
    const estimation = gestureEstimator.estimate(keypoints3D, 7.0);
    if (estimation.gestures.length === 0) return null;
    return estimation.gestures.reduce((best, candidate) => best.score > candidate.score ? best : candidate);
}

// mode picker dropdown

window.toggleDropdown = function () {
    document.getElementById('modeMenu').classList.toggle('show');
}

window.selectMode = async function (modeId, modeLabel, element) {
    document.getElementById('currentModeLabel').innerText = modeLabel;

    document.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('active'));
    element.classList.add('active');

    document.getElementById('modeMenu').classList.remove('show');

    currentTrackingMode = modeId;
    lastCslTopGuessDiagnostic = null;
    letterSessionCountdownComplete = false;
    window.clearWord();
    staticSignStreak = 0;
    dynamicSignStreak = 0;
    clearHandCache();
    stopWlaslCaptureLoop();

    const generation = ++modeGeneration;
    const resumeDetection = Boolean(cameraStream && !webcamVideo.paused);
    isDetecting = false;
    window.cancelAnimationFrame(animationFrame);
    setCaptureGuide("analyzing", "Loading recognition", `Preparing ${modeLabel}…`, 0);
    cameraToggleBtn.disabled = true;
    try {
        await configureSelectedMode();
        if (disposed || generation !== modeGeneration) return;
        guessLabelDisplay.innerText = `Mode: ${modeLabel}`;
        rawExtractionDisplay.innerText = modeId === "csl_word" ? "[CSL]" : modeId === "asl_word" ? getAslWordRuntimeLabel() : "...";
        if (resumeDetection) {
            isDetecting = true;
            prepareForNextCapture();
            processVideoFrames();
        } else {
            setCaptureGuide("off", "Camera off", "Recognition is ready. Start the camera when you are ready.", 0);
        }
    } catch (error) {
        if (!disposed && generation === modeGeneration) {
            window.stopCam();
            setCaptureGuide("off", "Recognition unavailable", error.message, 0);
        }
    } finally {
        if (!disposed && generation === modeGeneration) cameraToggleBtn.disabled = false;
    }
}

// clicking anywhere else closes the dropdown
window.addEventListener('click', function (event) {
    // Close the mode picker dropdown if clicking outside
    if (!event.target.closest('.custom-dropdown')) {
        let menu = document.getElementById("modeMenu");
        if (menu && menu.classList.contains('show')) {
            menu.classList.remove('show');
        }
    }

}, { signal: listeners.signal });

window.startCam = async function () {
    if (startingCamera || disposed) return;
    startingCamera = true;
    const generation = ++modeGeneration;
    cameraToggleBtn.disabled = true;
    cameraToggleBtn.textContent = "Loading recognition…";
    setCaptureGuide("analyzing", "Loading recognition", "Preparing detection before opening your camera…", 0);
    try {
        await configureSelectedMode();
        if (disposed || generation !== modeGeneration) return;
        cameraToggleBtn.textContent = "Opening camera…";
        setCaptureGuide("analyzing", "Opening camera", "Allow camera access to start detecting signs.", 0);

        // Request a sharper 4:3 phone feed while keeping recognition work
        // throttled separately below. `ideal` lets lower-end cameras fall back
        // gracefully instead of failing the camera request.
        const cameraConfig = isMobileDevice
            ? {
                facingMode: activeCameraFacing,
                width: { ideal: 1280 },
                height: { ideal: 960 },
                aspectRatio: { ideal: 4 / 3 },
                frameRate: { ideal: 24, max: 30 }
            }
            : { facingMode: activeCameraFacing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };

        const stream = await navigator.mediaDevices.getUserMedia({ video: cameraConfig });
        if (disposed || generation !== modeGeneration) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }
        cameraStream = stream;

        webcamVideo.srcObject = cameraStream;
        await webcamVideo.play();
        if (disposed || generation !== modeGeneration) return;

        // only mirror the video if we're using the front-facing "selfie" camera
        const videoContainer = webcamVideo.closest('.video-container');
        if (videoContainer) {
            if (activeCameraFacing === 'user') {
                videoContainer.classList.add('mirror-mode');
            } else {
                videoContainer.classList.remove('mirror-mode');
            }
        }

        letterSessionCountdownComplete = false;
        lastDetectionAt = 0;
        isDetecting = true;
        prepareForNextCapture();
        processVideoFrames();
        if (!isDetecting) return;

        cameraToggleBtn.textContent = "Stop Camera";
        cameraToggleBtn.onclick = window.stopCam;

        if (pauseToggleBtn) {
            pauseToggleBtn.style.display = "inline-block";
            pauseToggleBtn.textContent = "Pause Camera";
            pauseToggleBtn.onclick = window.pauseCam;
        }
    } catch (err) {
        if (!disposed) {
            window.stopCam();
            setCaptureGuide("off", "Unable to start detection", `${err.message || "Check camera permission and your connection."} Try Start Camera again.`, 0);
        }
        console.error(err);
    } finally {
        startingCamera = false;
        if (!disposed) {
            cameraToggleBtn.disabled = false;
            cameraToggleBtn.textContent = isDetecting ? "Stop Camera" : "Start Camera";
        }
    }
}

window.pauseCam = function () {
    window.cancelAnimationFrame(animationFrame);
    webcamVideo.pause();
    isDetecting = false;
    cancelCaptureCountdown();
    setCaptureActive(false);
    clearHandCache();
    stopWlaslCaptureLoop();
    setCaptureGuide("off", "Camera paused", "Resume when you are ready to continue.", 0);

    if (pauseToggleBtn) {
        pauseToggleBtn.textContent = "Resume Camera";
        pauseToggleBtn.onclick = window.resumeCam;
    }
}

window.resumeCam = async function () {
    clearHandCache();
    await webcamVideo.play();
    lastDetectionAt = 0;
    isDetecting = true;
    prepareForNextCapture();
    processVideoFrames();

    if (pauseToggleBtn) {
        pauseToggleBtn.textContent = "Pause Camera";
        pauseToggleBtn.onclick = window.pauseCam;
    }
}

window.stopCam = function () {
    ++modeGeneration;
    window.cancelAnimationFrame(animationFrame);
    cancelCaptureCountdown();
    setCaptureActive(false);
    stopWlaslCaptureLoop();
    letterSessionCountdownComplete = false;
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (webcamVideo) {
        webcamVideo.pause();
        webcamVideo.removeAttribute('src');
        webcamVideo.removeAttribute('srcObject');
        webcamVideo.srcObject = null;
        webcamVideo.load();
    }
    isDetecting = false;
    lastDetectionAt = 0;

    cameraToggleBtn.textContent = "Start Camera";
    cameraToggleBtn.onclick = window.startCam;

    if (pauseToggleBtn) {
        pauseToggleBtn.style.display = "none";
        pauseToggleBtn.textContent = "Pause Camera";
        pauseToggleBtn.onclick = window.pauseCam;
    }

    // wipe the skeleton overlay and forget cached hand positions
    canvasContext.clearRect(0, 0, overlayCanvasElement.width, overlayCanvasElement.height);
    clearHandCache();
    setCaptureGuide("off", "Camera off", "Start the camera when you are ready.", 0);
}

function drawWlaslRecordingFrame() {
    if (!wlaslRecordingContext || !webcamVideo.videoWidth || !webcamVideo.videoHeight) return;
    // The released checkpoint was trained on square WLASL videos. Preserve the
    // whole webcam frame while matching that spatial contract; center-cropping
    // a 16:9 source removes exactly the lateral hand motion the model needs.
    wlaslRecordingContext.drawImage(
        webcamVideo,
        0,
        0,
        webcamVideo.videoWidth,
        webcamVideo.videoHeight,
        0,
        0,
        WLASL_RECORDING_SIZE,
        WLASL_RECORDING_SIZE
    );
}

function getWlaslRecorderStream() {
    if (typeof wlaslRecordingCanvas.captureStream !== 'function') return cameraStream;
    drawWlaslRecordingFrame();
    if (!wlaslRecorderStream?.active) {
        wlaslRecorderStream = wlaslRecordingCanvas.captureStream(WLASL_RECORDING_FPS);
    }
    return wlaslRecorderStream;
}

function startWlaslCaptureLoop() {
    if (!wlaslBackendReady || !isDetecting || currentTrackingMode !== "asl_word" || !cameraStream) return;
    if (wlaslRecorder && wlaslRecorder.state !== 'inactive') return;

    const generation = wlaslCaptureGeneration;
    const recordingStream = getWlaslRecorderStream();
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find(type => MediaRecorder.isTypeSupported(type));
    try {
        wlaslRecorderChunks = [];
        wlaslRecorder = mimeType
            ? new MediaRecorder(recordingStream, { mimeType })
            : new MediaRecorder(recordingStream);
    } catch (error) {
        rawExtractionDisplay.innerText = "This browser cannot record a WLASL clip";
        setCaptureGuide("waiting", "Capture unavailable", "Try a different browser or ASL mode.", 0);
        console.error("Unable to create WLASL recorder:", error);
        return;
    }

    wlaslRecorder.ondataavailable = event => {
        if (event.data?.size) wlaslRecorderChunks.push(event.data);
    };
    wlaslRecorder.onstop = () => {
        clearTimeout(wlaslCaptureTimer);
        if (generation !== wlaslCaptureGeneration) return;
        const trackedHandFrames = wlaslTrackedHandFrames;
        const clip = new Blob(wlaslRecorderChunks, { type: wlaslRecorder.mimeType || 'video/webm' });
        wlaslRecorder = null;
        wlaslRecorderChunks = [];
        // Keep recording while the previous window is classified. Hand
        // tracking gates inference below, while the recorder stays gap-free.
        if (isDetecting && currentTrackingMode === "asl_word") startWlaslCaptureLoop();
        if (shouldSubmitAslWordClip({ clipSize: clip.size, trackedHandFrames })) {
            if (wlaslRequestInFlight) {
                wlaslPendingClip = { clip, generation, trackedHandFrames };
            } else {
                submitWlaslClip(clip, generation, trackedHandFrames);
            }
        }
    };
    wlaslTrackedHandFrames = 0;
    wlaslRecorder.start();
    setCaptureActive(true);
    wlaslCaptureStartedAt = performance.now();
    if (latestHandsVisible) {
        showWordCaptureProgress(0, WLASL_CLIP_WINDOW_MS);
        startCaptureCountdown();
    } else {
        showWaitingForInputGuide();
    }
    rawExtractionDisplay.innerText = latestHandsVisible
        ? "Watching for one ASL word…"
        : "Waiting for hands…";
    wlaslCaptureTimer = setTimeout(() => {
        if (wlaslRecorder?.state === 'recording') wlaslRecorder.stop();
    }, WLASL_CLIP_WINDOW_MS);
}

function stopWlaslCaptureLoop() {
    wlaslCaptureGeneration++;
    clearTimeout(wlaslCaptureTimer);
    wlaslCaptureTimer = null;
    if (wlaslRecorder && wlaslRecorder.state !== 'inactive') {
        wlaslRecorder.onstop = null;
        wlaslRecorder.stop();
    }
    wlaslRecorder = null;
    wlaslRecorderChunks = [];
    wlaslCaptureStartedAt = null;
    wlaslPendingClip = null;
    wlaslTrackedHandFrames = 0;
    if (wlaslRecorderStream && wlaslRecorderStream !== cameraStream) {
        wlaslRecorderStream.getTracks().forEach(track => track.stop());
    }
    wlaslRecorderStream = null;
}

async function submitWlaslClip(clip, generation, trackedHandFrames) {
    if (!shouldSubmitAslWordClip({ clipSize: clip?.size, trackedHandFrames })) return;
    wlaslRequestInFlight = true;
    rawExtractionDisplay.innerText = "Recognizing…";
    setCaptureGuide("analyzing", "Checking your sign", "Please wait for the result.", 0);
    const form = new FormData();
    form.append('video', clip, 'wlasl-window.webm');
    try {
        const response = await fetch(`${wlaslApiUrl}/predict`, { method: 'POST', body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.detail || `WLASL API returned ${response.status}`);
        if (generation !== wlaslCaptureGeneration || currentTrackingMode !== "asl_word") return;

        const predictions = Array.isArray(result.predictions) ? result.predictions : [];
        // New services make an explicit closed-set/no-sign decision. Keep the
        // confidence fallback so the browser remains compatible with an older
        // service while it is being restarted.
        const detected = result.detected === true
            || (result.detected == null && result.confidence >= WLASL_BACKEND_CONFIDENCE);
        if (detected && predictions.length) {
            showDynamicMatch(result.word, result.confidence);
            acceptDynamicWord(predictions, undefined, { lockRecognition: false });
            rawExtractionDisplay.innerText = result.word;
            setCaptureGuide("accepted", `${result.word} accepted`, "Recognition is still running.", 1);
        } else {
            showDynamicIdle(result.confidence || 0, true);
            rawExtractionDisplay.innerText = result.rejectionReason === 'no_motion'
                ? "Waiting for a complete sign…"
                : "No confident ASL word yet";
            setCaptureGuide(
                "ready",
                "Try one complete sign",
                "Recognition is still running; begin the next sign naturally.",
                0
            );
        }
    } catch (error) {
        console.error("WLASL prediction failed:", error);
        rawExtractionDisplay.innerText = "WLASL service unavailable";
        setCaptureGuide("waiting", "Recognition unavailable", "Check the WLASL service, then try again.", 0);
    } finally {
        wlaslRequestInFlight = false;
        const pending = wlaslPendingClip;
        wlaslPendingClip = null;
        if (pending && isDetecting && currentTrackingMode === "asl_word") {
            submitWlaslClip(pending.clip, pending.generation, pending.trackedHandFrames);
        }
    }
}

window.flipCam = async function () {
    if (startingCamera || cameraToggleBtn.disabled) return;
    activeCameraFacing = activeCameraFacing === "user" ? "environment" : "user";
    window.stopCam();
    await window.startCam();
}



window.clearWord = function () {
    accumulatedWord = "";
    sentenceBuilderDisplay.innerHTML = "";

    setFinalTranslation("");
    rawExtractionDisplay.innerText = "...";
}

window.backspaceWord = function () {
    if (!sentenceBuilderDisplay) return;

    // Recognized words add a trailing space node. Remove that separator first,
    // then remove the latest complete word dropdown or letter span.
    while (sentenceBuilderDisplay.lastChild?.nodeType === Node.TEXT_NODE
        && !sentenceBuilderDisplay.lastChild.textContent.trim()) {
        sentenceBuilderDisplay.lastChild.remove();
    }

    sentenceBuilderDisplay.lastChild?.remove();
    syncSentenceState();
    setFinalTranslation("");
    rawExtractionDisplay.innerText = "...";
}

window.translateSentence = async function () {
    if (translationInFlight) return;
    syncSentenceState();
    if (!accumulatedWord) {
        setFinalTranslation("Add signs to your sentence before interpreting the context.");
        return;
    }
    const input = accumulatedWord;
    translationInFlight = true;
    const button = document.getElementById('translateSentenceBtn');
    button.disabled = true;
    button.textContent = "Interpreting…";

    setFinalTranslation("Dexter is thinking...");

    try {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aslString: input }),
            signal: AbortSignal.timeout(25000)
        });

        const data = await response.json().catch(() => ({}));
        if (disposed || input !== accumulatedWord) return;
        if (!response.ok) {
            setFinalTranslation(data.error || "Translation service is unavailable. Please try again.");
            return;
        }

        const translation = data?.translation;
        const hasBilingualTranslation = typeof translation?.khmer === "string"
            && Boolean(translation.khmer.trim())
            && typeof translation?.english === "string"
            && Boolean(translation.english.trim());
        setFinalTranslation(
            hasBilingualTranslation ? translation : "Error: Empty bilingual response.",
            { speakable: hasBilingualTranslation }
        );
    } catch (err) {
        console.error("Network issue:", err);
        if (!disposed && input === accumulatedWord) setFinalTranslation(err.name === "TimeoutError"
            ? "Translation took too long. Please try again."
            : "Network error. Check your connection and try again.");
    } finally {
        translationInFlight = false;
        button.disabled = false;
        button.textContent = "Interpret Context";
    }
}

const speechSynthesisSupported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const speechAudioSupported = "Audio" in window;
let speakableTranslations = [];
let activeTranslationUtterance = null;
let activeTranslationAudio = null;

function getSelectedSpeakableTranslation() {
    const selectedLanguage = speechLanguageSelect?.value;
    return speakableTranslations.find(item => item.id === selectedLanguage) || speakableTranslations[0] || null;
}

function updateSpeakTranslationButton(isSpeaking = false) {
    if (!speakTranslationButton) return;

    const speechItem = getSelectedSpeakableTranslation();
    const canSpeak = (speechSynthesisSupported || speechAudioSupported)
        && Boolean(speechItem);
    const speechLabel = speechItem ? `${speechItem.label} translation` : "translation";
    if (speechLanguageSelect) speechLanguageSelect.disabled = !canSpeak;
    speakTranslationButton.disabled = !canSpeak;
    speakTranslationButton.classList.toggle("is-speaking", isSpeaking);
    speakTranslationButton.setAttribute(
        "aria-label",
        isSpeaking ? `Stop speaking ${speechLabel}` : `Speak ${speechLabel}`
    );
    speakTranslationButton.title = canSpeak
        ? (isSpeaking ? `Stop speaking ${speechLabel}` : `Speak ${speechLabel}`)
        : !speechItem ? "Interpret a sentence to enable speech"
        : "Text to speech is not supported by this browser";
}

function setSpeechStatus(message = "", isError = false) {
    if (!speechStatusDisplay) return;
    speechStatusDisplay.innerText = message;
    speechStatusDisplay.classList.toggle("is-error", isError);
}

function cancelTranslationSpeech() {
    activeTranslationUtterance = null;
    if (speechSynthesisSupported) window.speechSynthesis.cancel();
    if (activeTranslationAudio) {
        activeTranslationAudio.pause();
        activeTranslationAudio.removeAttribute("src");
        activeTranslationAudio = null;
    }
    setSpeechStatus();
    updateSpeakTranslationButton(false);
}

function setFinalTranslation(text, { speakable = false } = {}) {
    cancelTranslationSpeech();
    const isBilingual = text
        && typeof text === "object"
        && typeof text.khmer === "string"
        && typeof text.english === "string";

    speakableTranslations = speakable && isBilingual
        ? [
            { id: "khmer", label: "Khmer", text: text.khmer.trim(), lang: "km-KH" },
            { id: "english", label: "English", text: text.english.trim(), lang: "en-US" }
        ].filter(item => item.text)
        : [];

    if (speechLanguageSelect && !speakableTranslations.some(item => item.id === speechLanguageSelect.value)) {
        speechLanguageSelect.value = speakableTranslations[0]?.id || "khmer";
    }

    if (translationStatusDisplay) {
        translationStatusDisplay.innerText = isBilingual ? "" : String(text || "");
    }
    if (bilingualTranslationDisplay) bilingualTranslationDisplay.hidden = !isBilingual;
    if (khmerTranslationDisplay) khmerTranslationDisplay.innerText = isBilingual ? text.khmer.trim() : "";
    if (englishTranslationDisplay) englishTranslationDisplay.innerText = isBilingual ? text.english.trim() : "";
    updateSpeakTranslationButton(false);
}

function speakSelectedTranslation(speechItem) {
    const utterance = new SpeechSynthesisUtterance(speechItem.text);
    utterance.lang = speechItem.lang;
    utterance.onstart = () => {
        if (activeTranslationUtterance === utterance) updateSpeakTranslationButton(true);
    };
    utterance.onend = () => {
        if (activeTranslationUtterance !== utterance) return;
        activeTranslationUtterance = null;
        updateSpeakTranslationButton(false);
    };
    utterance.onerror = utterance.onend;

    activeTranslationUtterance = utterance;
    updateSpeakTranslationButton(true);
    window.speechSynthesis.speak(utterance);
}

function playGeneratedTranslation(speechItem) {
    const params = new URLSearchParams({
        language: speechItem.lang,
        text: speechItem.text
    });
    const audio = new Audio(`/api/speech?${params.toString()}`);
    let finished = false;

    const finish = (errorMessage = "") => {
        if (finished) return;
        finished = true;
        if (activeTranslationAudio === audio) activeTranslationAudio = null;
        updateSpeakTranslationButton(false);
        setSpeechStatus(errorMessage, Boolean(errorMessage));
    };

    audio.preload = "auto";
    audio.onplaying = () => setSpeechStatus();
    audio.onended = () => finish();
    audio.onerror = () => finish(`${speechItem.label} audio is unavailable. Please try again.`);

    activeTranslationAudio = audio;
    setSpeechStatus(`Preparing ${speechItem.label} audio…`);
    updateSpeakTranslationButton(true);
    const playPromise = audio.play();
    if (playPromise?.catch) {
        playPromise.catch(() => finish(`${speechItem.label} audio could not play. Please try again.`));
    }
}

window.speakTranslation = function () {
    const speechItem = getSelectedSpeakableTranslation();
    if (!speechItem) return;

    if (activeTranslationUtterance || activeTranslationAudio) {
        cancelTranslationSpeech();
        return;
    }

    if (speechItem.id === "khmer" || !speechSynthesisSupported) {
        if (speechAudioSupported) playGeneratedTranslation(speechItem);
        else setSpeechStatus("Text to speech is not supported by this browser.", true);
        return;
    }

    speakSelectedTranslation(speechItem);
}

speechLanguageSelect?.addEventListener("change", cancelTranslationSpeech, { signal: listeners.signal });

updateSpeakTranslationButton(false);



const calculateDistance = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

// stitch together pose + both hands into one flat array the model expects
function buildHolisticFrame(poseData, handData, assignedHands = null) {
    let rawPose = new Array(33 * 3).fill(0);

    if (poseData?.landmarks?.length > 0) {
        const poseLandmarks = poseData.landmarks[0];
        for (let i = 0; i < poseLandmarks.length; i++) {
            rawPose[i * 3] = poseLandmarks[i].x;
            rawPose[i * 3 + 1] = poseLandmarks[i].y;
            rawPose[i * 3 + 2] = poseLandmarks[i].z;
        }
    }

    const assigned = assignedHands || assignDetectedHands(handData, poseData);
    const leftHand = flattenHand(assigned.left);
    const rightHand = flattenHand(assigned.right);

    return [...rawPose, ...leftHand, ...rightHand];
}

function flattenHand(hand) {
    const output = new Array(63).fill(0);
    if (!hand) return output;
    for (let index = 0; index < Math.min(21, hand.length); index++) {
        output[index * 3] = hand[index].x;
        output[index * 3 + 1] = hand[index].y;
        output[index * 3 + 2] = hand[index].z;
    }
    return output;
}

function assignDetectedHands(handData, poseData = null) {
    const assigned = { left: null, right: null };
    for (let index = 0; index < (handData?.landmarks?.length || 0); index++) {
        const category = handData?.handednesses?.[index]?.[0];
        const label = String(category?.categoryName || category?.displayName || '').toLowerCase();
        if (label === 'left' || label === 'right') assigned[label] = handData.landmarks[index];
    }
    return assigned;
}

// center everything relative to the body so the model isn't thrown off
// by where the person is standing in the frame
function centerFrameData(rawFrame) {
    // try nose first, then fall back to wrists
    let anchorX = rawFrame[0];
    let anchorY = rawFrame[1];

    if (anchorX === 0 && anchorY === 0) {
        anchorX = rawFrame[99];
        anchorY = rawFrame[100];
    }
    if (anchorX === 0 && anchorY === 0) {
        anchorX = rawFrame[162];
        anchorY = rawFrame[163];
    }

    if (anchorX === 0 && anchorY === 0) return rawFrame;

    let centered = [];
    for (let i = 0; i < rawFrame.length; i += 3) {
        let x = rawFrame[i];
        let y = rawFrame[i + 1];
        let z = rawFrame[i + 2];

        if (x === 0 && y === 0) {
            centered.push(0, 0, 0);
        } else {
            centered.push(x - anchorX, y - anchorY, z);
        }
    }
    return centered;
}

function pauseCadtCslSampler() {
    cadtCslLastObservedFrame = null;
    cadtCslLastObservedAt = null;
    cadtCslNextSampleAt = null;
}

function resetCadtCslCaptureState() {
    pauseCadtCslSampler();
    cslHandLossStartedAt = null;
    cslHandLossResetComplete = false;
}

function appendTimedCadtCslFrame(frame, timestamp, maximumFrames) {
    if (!cadtCslLastObservedFrame || !Number.isFinite(cadtCslLastObservedAt)) {
        cadtCslHandBuffer.push(frame);
        cadtCslLastObservedFrame = frame;
        cadtCslLastObservedAt = timestamp;
        cadtCslNextSampleAt = timestamp + CSL_CAPTURE_SAMPLE_INTERVAL_MS;
    } else {
        const observedDuration = Math.max(1, timestamp - cadtCslLastObservedAt);
        while (cadtCslNextSampleAt <= timestamp) {
            const ratio = (cadtCslNextSampleAt - cadtCslLastObservedAt) / observedDuration;
            cadtCslHandBuffer.push(interpolateCadtCslFrame(cadtCslLastObservedFrame, frame, ratio));
            cadtCslNextSampleAt += CSL_CAPTURE_SAMPLE_INTERVAL_MS;
        }
        cadtCslLastObservedFrame = frame;
        cadtCslLastObservedAt = timestamp;
    }
    while (cadtCslHandBuffer.length > maximumFrames) cadtCslHandBuffer.shift();
}

function clearHandCache({ preserveReleaseGate = false } = {}) {
    predictionVotes = [];
    motionBuffer = [];
    cadtCslHandBuffer = [];
    cslCaptureEvaluationComplete = false;
    resetCadtCslCaptureState();
    motionTimestampBuffer = [];
    wlaslFrameBuffer = [];
    commonAslWordFrames = [];
    lastWlaslInferenceAt = 0;
    wristVelocityBuffer = [];
    routingWristHistory = { Left: [], Right: [] };
    resetStaticRecognitionState();
    if (!preserveReleaseGate) {
        resetWordRecognitionState();
        resetDynamicLetterRecognitionState();
    }
}

function setCaptureGuide(state, label, detail, progress = 0) {
    if (!captureGuide) return;
    const normalizedProgress = Math.max(0, Math.min(1, Number(progress) || 0));
    const percent = Math.round(normalizedProgress * 100);

    captureGuide.dataset.state = state;
    syncCameraCaptureAppearance();
    if (captureStateLabel.textContent !== label) captureStateLabel.textContent = label;
    if (captureStateDetail.textContent !== detail) captureStateDetail.textContent = detail;
    captureProgressBar.style.width = `${percent}%`;
    captureProgressTrack.setAttribute('aria-valuenow', String(percent));
}

function syncCameraCaptureAppearance() {
    const wordModeIsIdle = (currentTrackingMode === "asl_word" || currentTrackingMode === "csl_word")
        && isDetecting
        && !latestHandsVisible;
    const shouldDim = Boolean(cameraStream) && (wordModeIsIdle || !captureIsActive);
    webcamContainer?.classList.toggle('is-dimmed', shouldDim);
}

function setCaptureActive(active) {
    captureIsActive = Boolean(active);
    syncCameraCaptureAppearance();
}

function hideCaptureCountdown() {
    if (captureCountdown) captureCountdown.hidden = true;
}

function cancelCaptureCountdown() {
    captureCountdownGeneration++;
    clearTimeout(captureCountdownTimer);
    captureCountdownTimer = null;
    hideCaptureCountdown();
}

function prepareForNextCapture() {
    cancelCaptureCountdown();
    latestHandsVisible = false;
    if (!isDetecting) return;
    if (currentTrackingMode === "asl_word" && wlaslBackendReady) {
        setCaptureActive(true);
        showReadyCaptureGuide();
        startWlaslCaptureLoop();
        return;
    }
    setCaptureActive(false);
    showWaitingForInputGuide();
    if (currentTrackingMode === "asl_letter" && letterSessionCountdownComplete) {
        if (latestHandsVisible) {
            setCaptureActive(true);
            showReadyCaptureGuide();
        }
        return;
    }
}

function showCaptureCountdown(value) {
    if (captureCountdownNumber) captureCountdownNumber.textContent = String(value);
    if (captureCountdown) captureCountdown.hidden = false;
    const isWordMode = currentTrackingMode === "asl_word" || currentTrackingMode === "csl_word";
    setCaptureGuide(
        "countdown",
        `Capture starts in ${value}`,
        isWordMode
            ? "Hold your starting position and keep your hands visible."
            : "Hold your starting position. Frames are not being saved yet.",
        (CAPTURE_COUNTDOWN_START - value) / CAPTURE_COUNTDOWN_START
    );
}

function startCaptureCountdown() {
    const visualOnly = currentTrackingMode === "asl_word";
    if (
        !isDetecting
        || (!visualOnly && captureIsActive)
        || captureCountdownTimer
        || !latestHandsVisible
    ) return;

    const generation = ++captureCountdownGeneration;
    let value = CAPTURE_COUNTDOWN_START;
    showCaptureCountdown(value);

    const advance = () => {
        if (generation !== captureCountdownGeneration || !isDetecting) return;
        if (!latestHandsVisible) {
            cancelCaptureCountdown();
            if (!visualOnly) setCaptureActive(false);
            showWaitingForInputGuide();
            return;
        }

        value--;
        if (value > 0) {
            showCaptureCountdown(value);
            captureCountdownTimer = setTimeout(advance, CAPTURE_COUNTDOWN_STEP_MS);
            return;
        }

        captureCountdownTimer = null;
        hideCaptureCountdown();
        if (visualOnly) return;
        clearHandCache();
        if (currentTrackingMode === "asl_letter") letterSessionCountdownComplete = true;
        setCaptureActive(true);
        showReadyCaptureGuide();
    };

    captureCountdownTimer = setTimeout(advance, CAPTURE_COUNTDOWN_STEP_MS);
}

function showWaitingForInputGuide() {
    setCaptureGuide(
        "waiting",
        currentTrackingMode === "asl_word" ? "Get ready to sign" : "Finding your hands",
        currentTrackingMode === "asl_letter"
            ? "Place one hand fully inside the camera frame."
            : (currentTrackingMode === "asl_word"
                ? "Show your hands to start recognition and the timing cue."
                : "Keep both hands visible when the sign uses two hands."),
        0
    );
}

function showReadyCaptureGuide() {
    if (!isDetecting) return;
    setCaptureGuide(
        "ready",
        currentTrackingMode === "asl_letter" ? "Ready for a letter" : "Ready for one word",
        currentTrackingMode === "asl_letter"
            ? "Make the handshape and hold it steady."
            : "Sign at a comfortable pace and keep your hands visible.",
        0
    );
}

function showWordCaptureProgress(elapsedMs, durationMs) {
    const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
    setCaptureGuide(
        progress < 1 ? "capturing" : "ready",
        progress < 1 ? "Capturing your sign" : "Checking your sign",
        progress < 1
            ? "This bar shows the saved clip window, not model confidence."
            : "Finish the sign naturally while Dexter checks the capture.",
        progress
    );
}

function resetStaticHoldTimer({ clearCandidate = true } = {}) {
    staticHoldElapsedMs = 0;
    staticHoldLastTickAt = null;
    staticSignStreak = 0;
    if (clearCandidate) {
        lastStaticGuess = "";
        staticLetterVotes = [];
    }
}

function resetStaticRecognitionState() {
    resetStaticHoldTimer();
    staticAwaitingRelease = false;
    acceptedStaticLetter = "";
    acceptedStaticSignature = [];
    staticReleaseStartedAt = null;
}

function timerDelta(timestamp) {
    if (!Number.isFinite(staticHoldLastTickAt)) {
        staticHoldLastTickAt = timestamp;
        return 0;
    }
    const delta = Math.max(0, Math.min(STATIC_HOLD_MAX_TICK_MS, timestamp - staticHoldLastTickAt));
    staticHoldLastTickAt = timestamp;
    return delta;
}

function decayStaticHold(timestamp) {
    staticHoldElapsedMs = Math.max(
        0,
        staticHoldElapsedMs - timerDelta(timestamp) * STATIC_HOLD_DECAY_RATE
    );
    if (staticHoldElapsedMs === 0) lastStaticGuess = "";
    return staticHoldElapsedMs / STATIC_HOLD_DURATION_MS;
}

function updateStaticRelease(handData, timestamp) {
    if (!staticAwaitingRelease) return false;
    const currentSignature = normalizeHandShapeSignature(buildHandSignature(handData));
    const released = currentSignature.length === 0
        || handSignatureDistance(acceptedStaticSignature, currentSignature)
            >= STATIC_RELEASE_SHAPE_THRESHOLD;

    if (!released) {
        staticReleaseStartedAt = null;
        setCaptureGuide(
            "accepted",
            `${acceptedStaticLetter} accepted`,
            "Release or make a clearly different handshape to continue.",
            1
        );
        return true;
    }

    if (staticReleaseStartedAt === null) staticReleaseStartedAt = timestamp;
    const progress = Math.min(1, (timestamp - staticReleaseStartedAt) / STATIC_RELEASE_DURATION_MS);
    setCaptureGuide(
        "accepted",
        "Release detected",
        "Keep your hand relaxed until the bar is full.",
        progress
    );

    if (progress >= 1) {
        resetStaticRecognitionState();
        clearHandCache();
        prepareForNextCapture();
    }
    return true;
}

function resetWordRecognitionState() {
    wordAwaitingRelease = false;
    acceptedWordLabel = "";
    acceptedWordRequiresShapeChange = false;
    acceptedWordSignature = [];
    dynamicPauseElapsedMs = 0;
    dynamicPauseLastTickAt = null;
    dynamicPauseLastSignature = [];
    latestHandSignature = [];
}

function resetDynamicLetterRecognitionState() {
    dynamicLetterAwaitingRelease = false;
    acceptedDynamicLetter = "";
    acceptedDynamicSignature = [];
    dynamicLetterReleaseElapsedMs = 0;
    dynamicLetterReleaseLastTickAt = null;
}

function lockDynamicLetterRecognition(letter, signature = latestHandSignature) {
    setCaptureActive(false);
    dynamicLetterAwaitingRelease = true;
    acceptedDynamicLetter = letter;
    acceptedDynamicSignature = normalizeHandShapeSignature(signature);
    dynamicLetterReleaseElapsedMs = 0;
    dynamicLetterReleaseLastTickAt = performance.now();
    setCaptureGuide(
        "accepted",
        `${letter} accepted`,
        "Relax or change your handshape before signing the next letter.",
        0
    );
}

function updateDynamicLetterRelease(handData, timestamp) {
    if (!dynamicLetterAwaitingRelease) return false;
    const rawDelta = Number.isFinite(dynamicLetterReleaseLastTickAt)
        ? timestamp - dynamicLetterReleaseLastTickAt
        : 0;
    const currentSignature = normalizeHandShapeSignature(buildHandSignature(handData));
    const shapeChanged = acceptedDynamicSignature.length > 0
        && currentSignature.length > 0
        && handSignatureDistance(acceptedDynamicSignature, currentSignature)
            >= STATIC_RELEASE_SHAPE_THRESHOLD;
    const isReleased = currentSignature.length === 0 || shapeChanged;

    dynamicLetterReleaseElapsedMs = updateReleaseProgress({
        elapsedMs: dynamicLetterReleaseElapsedMs,
        deltaMs: rawDelta,
        isReleased,
        durationMs: DYNAMIC_LETTER_RELEASE_DURATION_MS
    });
    dynamicLetterReleaseLastTickAt = timestamp;

    const progress = dynamicLetterReleaseElapsedMs / DYNAMIC_LETTER_RELEASE_DURATION_MS;
    setCaptureGuide(
        "accepted",
        isReleased ? "Release detected" : `${acceptedDynamicLetter} accepted`,
        isReleased
            ? "Keep the relaxed handshape until the bar is full."
            : "Relax or change your handshape before signing the next letter.",
        progress
    );

    if (progress < 1) return true;

    resetDynamicLetterRecognitionState();
    clearHandCache();
    prepareForNextCapture();
    return true;
}

function lockWordRecognition(
    label,
    signature = latestHandSignature,
    { requireShapeChange = false } = {}
) {
    setCaptureActive(false);
    wordAwaitingRelease = true;
    acceptedWordLabel = label;
    acceptedWordRequiresShapeChange = requireShapeChange;
    acceptedWordSignature = requireShapeChange
        ? normalizeHandShapeSignature(signature)
        : [];
    dynamicPauseElapsedMs = 0;
    dynamicPauseLastTickAt = performance.now();
    dynamicPauseLastSignature = copyHandSignature(signature);
    setCaptureGuide(
        "accepted",
        `${label} accepted`,
        requireShapeChange
            ? "Release or clearly change your handshape to continue."
            : "Finish the movement, then pause briefly to continue.",
        0
    );
}

function updateWordRelease(handData, timestamp) {
    const currentSignature = buildHandSignature(handData);
    latestHandSignature = currentSignature;
    const rawDelta = Number.isFinite(dynamicPauseLastTickAt)
        ? timestamp - dynamicPauseLastTickAt
        : 0;
    const delta = Math.max(0, Math.min(DYNAMIC_REARM_MAX_TICK_MS, rawDelta));
    const movement = handSignatureDistance(dynamicPauseLastSignature, currentSignature);
    const velocity = rawDelta > 0 && Number.isFinite(movement)
        ? movement * 1000 / rawDelta
        : Infinity;
    if (acceptedWordRequiresShapeChange) {
        const currentShape = normalizeHandShapeSignature(currentSignature);
        const shapeChanged = currentShape.length === 0
            || handSignatureDistance(acceptedWordSignature, currentShape)
                >= STATIC_RELEASE_SHAPE_THRESHOLD;
        dynamicPauseElapsedMs = updateReleaseProgress({
            elapsedMs: dynamicPauseElapsedMs,
            deltaMs: rawDelta,
            isReleased: shapeChanged,
            durationMs: STATIC_RELEASE_DURATION_MS
        });
        dynamicPauseLastTickAt = timestamp;
        dynamicPauseLastSignature = copyHandSignature(currentSignature);

        const progress = dynamicPauseElapsedMs / STATIC_RELEASE_DURATION_MS;
        setCaptureGuide(
            "accepted",
            shapeChanged ? "Release detected" : `${acceptedWordLabel} accepted`,
            shapeChanged
                ? "Keep the changed handshape until the bar is full."
                : "Release or clearly change your handshape to continue.",
            progress
        );
        if (progress < 1) return;

        resetWordRecognitionState();
        clearHandCache();
        prepareForNextCapture();
        return;
    }

    const isPaused = currentSignature.length === 0
        || (dynamicPauseLastSignature.length > 0 && velocity <= DYNAMIC_REARM_STILL_VELOCITY);

    dynamicPauseElapsedMs = updatePauseProgress({
        elapsedMs: dynamicPauseElapsedMs,
        deltaMs: delta,
        isPaused,
        durationMs: DYNAMIC_REARM_PAUSE_MS,
        maxTickMs: DYNAMIC_REARM_MAX_TICK_MS
    });
    dynamicPauseLastTickAt = timestamp;
    dynamicPauseLastSignature = copyHandSignature(currentSignature);

    const progress = dynamicPauseElapsedMs / DYNAMIC_REARM_PAUSE_MS;
    setCaptureGuide(
        "accepted",
        isPaused ? "Pause to continue" : `${acceptedWordLabel} accepted`,
        isPaused
            ? "Hold still briefly until the rearm bar is full."
            : "Finish the movement, then pause briefly to continue.",
        progress
    );

    if (progress < 1) return;

    resetWordRecognitionState();
    clearHandCache();
    prepareForNextCapture();
}

function updateWlaslCaptureProgress(timestamp) {
    if (wlaslRequestInFlight) {
        setCaptureGuide("analyzing", "Checking your sign", "Please wait for the result.", 0);
        return;
    }
    if (wlaslRecorder?.state !== 'recording' || !Number.isFinite(wlaslCaptureStartedAt)) return;
    showWordCaptureProgress(timestamp - wlaslCaptureStartedAt, WLASL_CLIP_WINDOW_MS);
}

// Use the most active visible hand to estimate motion for the optional legacy
// ASL landmark model. CSL inference still receives both hands independently.
function selectRoutingHand(handData) {
    const landmarks = handData?.landmarks || [];
    if (landmarks.length === 0) return null;

    const now = performance.now();
    const candidates = landmarks.map((hand, index) => {
        const classification = handData?.handednesses?.[index]?.[0];
        const side = classification?.categoryName || `Hand${index}`;

        if (!routingWristHistory[side]) routingWristHistory[side] = [];
        const history = routingWristHistory[side];
        history.push({ x: hand[0].x, y: hand[0].y, time: now });
        while (history.length > 10 || (history[0] && now - history[0].time > 750)) {
            history.shift();
        }

        let movement = 0;
        for (let i = 1; i < history.length; i++) {
            const dx = history[i].x - history[i - 1].x;
            const dy = history[i].y - history[i - 1].y;
            movement += Math.sqrt(dx * dx + dy * dy);
        }

        return {
            hand,
            side,
            movement,
            confidence: classification?.score || 0
        };
    });

    candidates.sort((a, b) =>
        (b.movement - a.movement) || (b.confidence - a.confidence)
    );
    return candidates[0];
}

function getDynamicThreshold() {
    if (wristVelocityBuffer.length < 2) return CONFIDENCE_THRESHOLD;

    const recent = wristVelocityBuffer.slice(-10);
    let totalDelta = 0;
    let deltaCount = 0;
    for (let i = 1; i < recent.length; i++) {
        // Do not interpret a switch between left and right routing hands as motion.
        if (recent[i].side !== recent[i - 1].side) continue;
        const dx = recent[i].x - recent[i - 1].x;
        const dy = recent[i].y - recent[i - 1].y;
        totalDelta += Math.sqrt(dx * dx + dy * dy);
        deltaCount++;
    }

    const avgVelocity = deltaCount > 0 ? totalDelta / deltaCount : 0;
    const minVelocity = 0.005;
    const maxVelocity = 0.015;
    const minThreshold = 0.80;
    const maxThreshold = 0.95;
    const clampedVelocity = Math.max(minVelocity, Math.min(maxVelocity, avgVelocity));
    const velocityRatio = (clampedVelocity - minVelocity) / (maxVelocity - minVelocity);
    const dynThreshold = minThreshold + velocityRatio * (maxThreshold - minThreshold);

    return dynThreshold;
}

function modelAcceptsCurrentBuffer(model, metadata = null) {
    if (metadata?.adapter === 'wlasl_rgb_video') {
        return model === wlaslModel && wlaslFrameBuffer.length > 0;
    }
    if (metadata?.adapter === 'cadt_csl_hands_v1') {
        const config = resolveCslRuntimeConfig(metadata);
        return cadtCslHandBuffer.length >= config.captureFrameCount;
    }
    const expectedFrameSize = model?.inputs?.[0]?.shape?.[2];
    const actualFrameSize = motionBuffer[0]?.length;
    if (!expectedFrameSize || !actualFrameSize) return false;
    return expectedFrameSize === actualFrameSize;
}

// the main loop — runs every animation frame while the camera is on
async function processVideoFrames() {
    if (!isDetecting || disposed) return;
    try {

    if (webcamVideo.videoWidth === 0) {
        animationFrame = window.requestAnimationFrame(processVideoFrames);
        return;
    }

    let currentTimeMs = performance.now();

    if (webcamVideo.currentTime !== previousVideoTime) {
        previousVideoTime = webcamVideo.currentTime;
        if (currentTrackingMode === "asl_word" && wlaslBackendReady) {
            drawWlaslRecordingFrame();
        }

        // A higher-resolution preview should not increase phone inference
        // frequency. This retains the former 15 FPS recognition workload.
        if (isMobileDevice && currentTimeMs - lastDetectionAt < MOBILE_DETECTION_INTERVAL_MS) {
            animationFrame = window.requestAnimationFrame(processVideoFrames);
            return;
        }
        lastDetectionAt = currentTimeMs;
        resizeCanvas();

        if (!handTracker) {
            animationFrame = window.requestAnimationFrame(processVideoFrames);
            return;
        }

        const detectedHands = handTracker.detectForVideo(webcamVideo, currentTimeMs);
        latestCslStaticHands = detectedHands.landmarks || [];
        let detectedPose = null;

        if (currentTrackingMode === "asl_word" && poseTracker) {
            detectedPose = poseTracker.detectForVideo(webcamVideo, currentTimeMs);
        }

        renderLandmarks(detectedPose, detectedHands);
        latestHandSignature = buildHandSignature(detectedHands);
        const handsWereVisible = latestHandsVisible;
        latestHandsVisible = hasVisibleHandLandmarks(detectedHands);
        syncCameraCaptureAppearance();
        if (currentTrackingMode === "csl_word" && latestHandsVisible) {
            cslHandLossStartedAt = null;
            cslHandLossResetComplete = false;
        }

        if (currentTrackingMode === "asl_word" && !wordAwaitingRelease) {
            commonAslWordFrames = appendCommonAslFrame(
                commonAslWordFrames,
                detectedHands,
                detectedPose,
                currentTimeMs
            );
            const commonWordMatch = captureIsActive && !captureCountdownTimer
                ? detectCommonAslWord(commonAslWordFrames)
                : null;
            if (commonWordMatch) {
                const releaseSignature = latestHandSignature;
                stopWlaslCaptureLoop();
                showDynamicMatch(commonWordMatch.word, commonWordMatch.confidence);
                acceptDynamicWord([{
                    word: commonWordMatch.word,
                    conf: commonWordMatch.confidence
                }], releaseSignature, { requireShapeChange: true });
                clearHandCache({ preserveReleaseGate: true });
            }
        }

        if (wordAwaitingRelease) {
            updateWordRelease(detectedHands, currentTimeMs);
        } else if (currentTrackingMode === "asl_word" && wlaslBackendReady) {
            // The backend consumes the camera clip directly; do not also run
            // the legacy landmark word model or let its idle state overwrite UI.
            // Keep the recorder continuous, but discard clips that do not
            // contain enough hand-tracked frames before calling WLASL.
            if (!wlaslRecorder) startWlaslCaptureLoop();
            if (latestHandsVisible && wlaslRecorder?.state === 'recording') {
                wlaslTrackedHandFrames++;
            }
            if (!latestHandsVisible) {
                if (captureCountdownTimer) cancelCaptureCountdown();
                rawExtractionDisplay.innerText = "Waiting for hands…";
                showWaitingForInputGuide();
            } else {
                if (!handsWereVisible) startCaptureCountdown();
                if (!captureCountdownTimer) updateWlaslCaptureProgress(currentTimeMs);
            }
        } else if (staticAwaitingRelease) {
            updateStaticRelease(detectedHands, currentTimeMs);
        } else if (dynamicLetterAwaitingRelease) {
            updateDynamicLetterRelease(detectedHands, currentTimeMs);
        } else if (!captureIsActive) {
            if (wlaslRequestInFlight) {
                updateWlaslCaptureProgress(currentTimeMs);
            } else if (currentTrackingMode === "asl_word" && wlaslBackendReady) {
                startCaptureCountdown();
            } else if (currentTrackingMode === "asl_letter" && letterSessionCountdownComplete) {
                if (latestHandsVisible) {
                    setCaptureActive(true);
                    showReadyCaptureGuide();
                } else {
                    showWaitingForInputGuide();
                }
            } else if (latestHandsVisible) {
                startCaptureCountdown();
            } else {
                if (captureCountdownTimer) cancelCaptureCountdown();
                if (currentTrackingMode !== "asl_letter") {
                    rawExtractionDisplay.innerText = "Waiting for hands…";
                }
                showWaitingForInputGuide();
            }
        } else if (latestHandsVisible) {
            analyzeMovement(detectedHands, detectedPose, currentTimeMs);
        } else if (currentTrackingMode === "csl_word") {
            if (!Number.isFinite(cslHandLossStartedAt)) {
                cslHandLossStartedAt = currentTimeMs;
                cslHandLossResetComplete = false;
                pauseCadtCslSampler();
            }
            const missingForMs = currentTimeMs - cslHandLossStartedAt;
            if (missingForMs < CSL_HAND_LOSS_GRACE_MS) {
                showCslTrackingUncertain();
            } else if (!cslHandLossResetComplete) {
                resetInactivity();
                cslHandLossResetComplete = true;
            }
        } else {
            resetInactivity();
        }
    }

    if (isDetecting && !disposed) animationFrame = window.requestAnimationFrame(processVideoFrames);
    } catch (error) {
        if (!disposed) {
            window.stopCam();
            setCaptureGuide("off", "Detection stopped", "Recognition failed. Try Start Camera again.", 0);
        }
        console.error("Detection failed", error);
    }
}

function resizeCanvas() {
    if (overlayCanvasElement.width !== webcamVideo.videoWidth) {
        overlayCanvasElement.width = webcamVideo.videoWidth;
        overlayCanvasElement.height = webcamVideo.videoHeight;
    }
    canvasContext.clearRect(0, 0, overlayCanvasElement.width, overlayCanvasElement.height);
}

// draw the skeleton lines on the canvas overlay
function renderLandmarks(poseData, handData) {
    if (!shouldDrawSkeletons) return;


    if (poseData?.landmarks?.length > 0) {
        const body = poseData.landmarks[0];
        canvasContext.strokeStyle = "lime";
        canvasContext.lineWidth = 2;

        for (const link of POSE_CONNECTIONS) {
            const x1 = body[link[0]].x * overlayCanvasElement.width;
            const y1 = body[link[0]].y * overlayCanvasElement.height;
            const x2 = body[link[1]].x * overlayCanvasElement.width;
            const y2 = body[link[1]].y * overlayCanvasElement.height;

            canvasContext.beginPath();
            canvasContext.moveTo(x1, y1);
            canvasContext.lineTo(x2, y2);
            canvasContext.stroke();
        }
    }


    if (handData?.landmarks) {
        canvasContext.strokeStyle = "cyan";
        canvasContext.lineWidth = 2;

        for (const hand of handData.landmarks) {
            for (const link of HAND_CONNECTIONS) {
                const x1 = hand[link[0]].x * overlayCanvasElement.width;
                const y1 = hand[link[0]].y * overlayCanvasElement.height;
                const x2 = hand[link[1]].x * overlayCanvasElement.width;
                const y2 = hand[link[1]].y * overlayCanvasElement.height;

                canvasContext.beginPath();
                canvasContext.moveTo(x1, y1);
                canvasContext.lineTo(x2, y2);
                canvasContext.stroke();
            }
        }
    }
}

// figure out what kind of sign is happening and route to the right detector
function analyzeMovement(handData, poseData, timestamp = performance.now()) {
    let currentFrame = [];
    const primaryHand = handData.landmarks?.length > 0 ? handData.landmarks[0] : null;
    const assignedWordHands = currentTrackingMode === "asl_letter"
        ? null
        : assignDetectedHands(handData, poseData);
    const routingHand = (currentTrackingMode === "asl_word" || currentTrackingMode === "csl_word")
        ? selectRoutingHand(handData)
        : null;

    if (currentTrackingMode === "asl_letter") {
        if (primaryHand) {
            for (let i = 0; i < primaryHand.length; i++) {
                currentFrame.push(primaryHand[i].x, primaryHand[i].y, primaryHand[i].z);
            }
        }
    } else {
        // Keep raw coordinates in the live buffer. Each model adapter applies
        // its own matching preprocessing immediately before inference.
        currentFrame = buildHolisticFrame(poseData, handData, assignedWordHands);
    }

    if (currentFrame.length > 0) {
        motionBuffer.push(currentFrame);
        motionTimestampBuffer.push(timestamp);
        if (currentTrackingMode !== "asl_letter") {
            while (
                motionBuffer.length > 2
                && timestamp - motionTimestampBuffer[0] > 2500
            ) {
                motionBuffer.shift();
                motionTimestampBuffer.shift();
            }
        } else if (motionBuffer.length > LEGACY_REQUIRED_FRAMES) {
            motionBuffer.shift();
            motionTimestampBuffer.shift();
        }
    }

    if (currentTrackingMode === "csl_word") {
        const captureFrameCount = resolveCslRuntimeConfig(activeModelMetadata).captureFrameCount;
        appendTimedCadtCslFrame(buildCadtCslHandFrame(handData), timestamp, captureFrameCount);
        showWordCaptureProgress(cadtCslHandBuffer.length, captureFrameCount);
    }

    if (currentTrackingMode === "asl_word" || currentTrackingMode === "csl_word") {
        if (routingHand) {
            wristVelocityBuffer.push({
                x: routingHand.hand[0].x,
                y: routingHand.hand[0].y,
                side: routingHand.side
            });
            if (wristVelocityBuffer.length > 10) wristVelocityBuffer.shift();
        }
    }

    if (currentTrackingMode === "asl_word" && motionTimestampBuffer.length > 1) {
        const elapsedMs = motionTimestampBuffer.at(-1) - motionTimestampBuffer[0];
        showWordCaptureProgress(elapsedMs, 1900);
    }

    // Static alphabet inference needs only the current hand. Keep collecting a
    // 30-frame window in parallel solely for the dynamic J/Z recognizer.
    if ((currentTrackingMode === "asl_letter" && primaryHand)
        || (currentTrackingMode !== "asl_letter" && motionBuffer.length >= 2)) {
        if (currentTrackingMode === "asl_letter") {
            const hand = primaryHand;
            const hasMotionWindow = motionBuffer.length >= LEGACY_REQUIRED_FRAMES;
            const recentStart = motionBuffer[Math.max(0, motionBuffer.length - 8)];
            const recentEnd = motionBuffer.at(-1);
            const recentMovement = Math.hypot(
                recentEnd[0] - recentStart[0],
                recentEnd[1] - recentStart[1]
            );
            const recentFrames = motionBuffer.slice(-8);
            const emergingLetterMotion = hasEmergingAslLetterMotion(recentFrames);
            const dynamicLetterIntent = getAslDynamicLetterIntent(motionBuffer);
            const intentionalLetterMotion = hasMotionWindow
                && (dynamicLetterIntent.J || dynamicLetterIntent.Z);
            if (recentMovement > 0.035 || emergingLetterMotion || intentionalLetterMotion) {
                resetStaticHoldTimer();
                showDynamicLetterPending();
                if (intentionalLetterMotion) inferDynamicGesture();
            } else if (hand) {
                inferStaticGesture(hand, timestamp);
            }
        } else {
            inferDynamicGesture();
        }
    }

    if (currentTrackingMode === "asl_word" && wlaslModel) {
        captureWlaslFrame(timestamp);
    }
}

function captureWlaslFrame(timestamp) {
    const size = wlaslConfig.imageSize;
    wlaslCaptureCanvas.width = size;
    wlaslCaptureCanvas.height = size;
    wlaslCaptureContext.drawImage(
        webcamVideo,
        0,
        0,
        webcamVideo.videoWidth,
        webcamVideo.videoHeight,
        0,
        0,
        size,
        size
    );
    wlaslFrameBuffer.push({ timestamp, rgba: wlaslCaptureContext.getImageData(0, 0, size, size).data });
    const cutoff = timestamp - wlaslConfig.clipDurationMs;
    while (wlaslFrameBuffer.length > 1 && wlaslFrameBuffer[0].timestamp < cutoff) wlaslFrameBuffer.shift();
}

function legacyHolisticSequence(frames, targetLength) {
    const prepared = frames.slice(-targetLength).map(frame => frame.slice());
    for (let frameIndex = 1; frameIndex < prepared.length; frameIndex++) {
        for (const [start, end] of [[99, 162], [162, 225]]) {
            if (prepared[frameIndex][start] === 0 && prepared[frameIndex][start + 1] === 0) {
                for (let valueIndex = start; valueIndex < end; valueIndex++) {
                    prepared[frameIndex][valueIndex] = prepared[frameIndex - 1][valueIndex];
                }
            }
        }
    }
    return prepared.map(centerFrameData);
}

function prepareInferenceInputs(model, metadata) {
    if (metadata?.adapter === 'wlasl_rgb_video') return prepareWlaslInferenceInputs(metadata);
    const sequenceLength = model?.inputs?.[0]?.shape?.[1] || metadata?.frameCount || LEGACY_REQUIRED_FRAMES;
    const frameWidth = model?.inputs?.[0]?.shape?.[2];

    let landmarkFrames;
    if (metadata?.adapter === 'cadt_csl_hands_v1' && frameWidth === 126) {
        landmarkFrames = prepareCadtCslSequence(cadtCslHandBuffer, sequenceLength);
        if (!landmarkFrames) return null;
    } else if (frameWidth === 225) {
        if (motionBuffer.length < sequenceLength) return null;
        landmarkFrames = legacyHolisticSequence(motionBuffer, sequenceLength);
    } else if (frameWidth === 63) {
        if (motionBuffer.length < sequenceLength) return null;
        landmarkFrames = motionBuffer.slice(-sequenceLength);
    } else {
        console.error(`Unsupported model input width: ${frameWidth}.`);
        return null;
    }

    const landmarkTensor = tf.tensor3d([landmarkFrames]);
    return {
        inputs: landmarkTensor,
        tensors: [landmarkTensor]
    };
}

function prepareWlaslInferenceInputs(config) {
    if (wlaslFrameBuffer.length < 2) return null;
    const duration = wlaslFrameBuffer.at(-1).timestamp - wlaslFrameBuffer[0].timestamp;
    if (duration < config.clipDurationMs * 0.8) return null;
    const indices = uniformSampleIndices(wlaslFrameBuffer.length, config.frameCount);
    const rgb = new Uint8Array(config.frameCount * config.imageSize * config.imageSize * 3);
    let target = 0;
    for (const index of indices) {
        const rgba = wlaslFrameBuffer[index].rgba;
        for (let source = 0; source < rgba.length; source += 4) {
            rgb[target++] = rgba[source];
            rgb[target++] = rgba[source + 1];
            rgb[target++] = rgba[source + 2];
        }
    }
    const values = normalizeRgbBytes(rgb, config.normalization);
    const tensor = tf.tensor5d(values, [1, config.frameCount, config.imageSize, config.imageSize, 3]);
    return { inputs: tensor, tensors: [tensor] };
}

function predictCadtCslWindows(model, metadata) {
    const config = resolveCslRuntimeConfig(metadata);
    const windowFrameCount = config.windowFrameCount;
    const offsets = config.windowOffsetsFromEnd;
    const windows = selectShiftedWindows(cadtCslHandBuffer, windowFrameCount, offsets);
    if (!windows.length) return null;

    const probabilityVectors = windows.map(windowFrames => {
        const prepared = prepareCadtCslSequence(windowFrames, windowFrameCount);
        const tensor = tf.tensor3d([prepared]);
        const prediction = model.predict(tensor);
        try {
            return Array.from(prediction.dataSync());
        } finally {
            tensor.dispose();
            prediction.dispose();
        }
    });
    return averageProbabilityVectors(probabilityVectors);
}

// run the tensorflow model on the buffered frames to recognize a motion sign
function inferDynamicGesture() {
    resetStaticHoldTimer();

    if (currentTrackingMode === "csl_word" && cslCaptureEvaluationComplete) return;

    if (currentTrackingMode === "asl_word" && wlaslModel) {
        const now = performance.now();
        if (now - lastWlaslInferenceAt < 500) return;
        lastWlaslInferenceAt = now;
    }

    const modelToUse = modelAcceptsCurrentBuffer(activeAIModel, activeModelMetadata)
        ? activeAIModel
        : null;
    const vocabularyToUse = activeVocabulary;
    const metadataToUse = activeModelMetadata;

    if (!modelToUse || !vocabularyToUse?.length) {
        if (currentTrackingMode === "csl_word" && !cslModel && cslStaticModel && latestCslStaticHands.length) {
            inferStaticCslFallback();
            return;
        }
        if (currentTrackingMode === "asl_word" && !aslWordModel && !wlaslBackendReady) {
            rawExtractionDisplay.innerText = "Try Hello, OK, or I love you";
        }
        showDynamicIdle(0, true);
        return;
    }

    const usesCadtWindows = metadataToUse?.adapter === "cadt_csl_hands_v1";
    let preparedInputs = null;
    let aiPrediction = null;
    let probabilities;

    try {
        if (usesCadtWindows) {
            probabilities = predictCadtCslWindows(modelToUse, metadataToUse);
            if (!probabilities) return;
            cslCaptureEvaluationComplete = true;
        } else {
            preparedInputs = prepareInferenceInputs(modelToUse, metadataToUse);
            if (!preparedInputs) {
                showDynamicIdle(0, true);
                return;
            }
            aiPrediction = modelToUse.predict(preparedInputs.inputs);
            probabilities = Array.from(aiPrediction.dataSync());
        }
    } catch (err) {
        preparedInputs?.tensors.forEach(tensor => tensor.dispose());
        aiPrediction?.dispose();
        console.error("Model inference failed:", err);
        return;
    }

    let mappedResults = probabilities.map((conf, idx) => ({ word: vocabularyToUse[idx], conf: conf }));
    mappedResults.sort((a, b) => b.conf - a.conf);

    const bestMatch = mappedResults[0];
    const secondMatch = mappedResults[1] || { word: "—", conf: 0 };
    const predictedSign = bestMatch.word;
    const confidenceLevel = bestMatch.conf;
    const minimumMargin = Number.isFinite(metadataToUse?.confidenceMargin)
        ? metadataToUse.confidenceMargin
        : 0;
    const staticAgreementConfig = usesCadtWindows
        ? resolveCslRuntimeConfig(metadataToUse).staticAgreement
        : {};
    const staticPredictions = currentTrackingMode === "csl_word"
        && staticAgreementConfig.enabled
        && cslStaticModel
        && latestCslStaticHands.length
        ? predictStaticCsl(cslStaticModel, latestCslStaticHands)
        : [];
    const staticAgreement = findStaticAgreement(
        predictedSign,
        staticPredictions,
        staticAgreementConfig.confidenceThreshold ?? CSL_STATIC_CONFIDENCE_THRESHOLD
    );
    const effectiveMargin = staticAgreement
        ? minimumMargin * (staticAgreementConfig.marginMultiplier ?? 1)
        : minimumMargin;
    const topTwoMargin = confidenceLevel - secondMatch.conf;
    const isUncertainCslPrediction = currentTrackingMode === "csl_word"
        && !hasSufficientTopTwoMargin(mappedResults, effectiveMargin);
    const cleanedSign = predictedSign.trim().toLowerCase();

    let isUserIdle = ["idle", "none", "", "still"].includes(cleanedSign);
    let aslLetterMotionIntent = null;
    let predictedMotionIsSupported = true;

    if (currentTrackingMode === "asl_letter") {
        aslLetterMotionIntent = getAslDynamicLetterIntent(motionBuffer);
        predictedMotionIsSupported = cleanedSign === "j"
            ? aslLetterMotionIntent.J
            : (cleanedSign === "z" ? aslLetterMotionIntent.Z : false);
        if (!aslLetterMotionIntent.J && !aslLetterMotionIntent.Z) isUserIdle = true;
    } else if (metadataToUse?.adapter !== 'cadt_csl_hands_v1') {
        let totalMovement = 0;
        let jointCount = 0;
        const firstFrame = motionBuffer[0];
        const lastFrame = motionBuffer[motionBuffer.length - 1];

        for (const region of [[99, 162], [162, 225]]) {
            for (let i = region[0]; i < region[1]; i += 3) {
                const oldX = firstFrame[i];
                const oldY = firstFrame[i + 1];
                const newX = lastFrame[i];
                const newY = lastFrame[i + 1];

                if ((oldX !== 0 || oldY !== 0) && (newX !== 0 || newY !== 0)) {
                    totalMovement += Math.sqrt(Math.pow(newX - oldX, 2) + Math.pow(newY - oldY, 2));
                    jointCount++;
                }
            }
        }

        const avgJointMovement = jointCount > 0 ? totalMovement / jointCount : 0;
        if (avgJointMovement < 0.003) {
            isUserIdle = true;
        }
    }

    const voteWord = isUncertainCslPrediction
        ? "idle"
        : currentTrackingMode === "asl_letter" && !predictedMotionIsSupported
        ? "idle"
        : predictedSign;
    predictionVotes.push({ word: voteWord, conf: confidenceLevel });
    if (predictionVotes.length > VOTE_WINDOW) predictionVotes.shift();

    const voteTally = {};
    let votedSign = predictedSign;
    let bestVoteScore = 0;
    let votedConfidence = confidenceLevel;

    for (const vote of predictionVotes) {
        if (!voteTally[vote.word]) voteTally[vote.word] = { count: 0, confSum: 0 };
        voteTally[vote.word].count++;
        voteTally[vote.word].confSum += vote.conf;
    }

    for (const [word, data] of Object.entries(voteTally)) {
        const score = data.count * (data.confSum / data.count);
        if (score > bestVoteScore) {
            bestVoteScore = score;
            votedSign = word;
            votedConfidence = data.confSum / data.count;
        }
    }

    const idleWords = ["idle", "none", "", "still", "មិនកម្រើក"];
    const votedLetter = votedSign.trim().toUpperCase();
    const votedMotionIsSupported = currentTrackingMode !== "asl_letter"
        || (votedLetter === "J" && aslLetterMotionIntent?.J)
        || (votedLetter === "Z" && aslLetterMotionIntent?.Z);
    const isVotedIdle = isUserIdle
        || isUncertainCslPrediction
        || !votedMotionIsSupported
        || idleWords.includes(votedSign.trim().toLowerCase());
    const threshold = currentTrackingMode === "asl_word" && wlaslModel
        ? wlaslConfig.confidenceThreshold
        : (Number.isFinite(metadataToUse?.confidenceThreshold)
            ? metadataToUse.confidenceThreshold
            : ((currentTrackingMode === "asl_word" || currentTrackingMode === "csl_word")
                ? getDynamicThreshold()
                : CONFIDENCE_THRESHOLD));

    let acceptedThisInference = false;
    if (!isVotedIdle && votedSign === predictedSign && votedConfidence > threshold) {
        showDynamicMatch(votedSign, votedConfidence);

        if (votedSign === lastDynamicGuess) {
            dynamicSignStreak++;
        } else {
            lastDynamicGuess = votedSign;
            dynamicSignStreak = 1;
        }

        const requiredHits = currentTrackingMode === "asl_letter"
            ? DYNAMIC_LETTER_REQUIRED_HITS
            : (usesCadtWindows ? 1 : 4);

        if (dynamicSignStreak >= requiredHits) {
            const topChoices = mappedResults
                .filter(res => !idleWords.includes(res.word.trim().toLowerCase()))
                .filter(res => currentTrackingMode !== "asl_letter"
                    || Boolean(aslLetterMotionIntent?.[res.word.trim().toUpperCase()]))
                .slice(0, 3);

            if (topChoices.length > 0) {
                acceptDynamicWord(topChoices);
                acceptedThisInference = true;
            }

            dynamicSignStreak = 0;
            motionBuffer = [];
            clearHandCache({ preserveReleaseGate: true });
            if (!dynamicLetterAwaitingRelease) showDynamicIdle(0, true);
        }
    } else {
        if (usesCadtWindows) {
            showCslRejectedPrediction({
                bestMatch,
                secondMatch,
                topTwoMargin,
                requiredMargin: effectiveMargin,
                confidenceThreshold: threshold,
                staticAgreement
            });
        } else {
            showDynamicIdle(confidenceLevel, isVotedIdle);
        }
        if (currentTrackingMode === "asl_letter") showDynamicLetterPending();
    }

    preparedInputs?.tensors.forEach(tensor => tensor.dispose());
    aiPrediction?.dispose();

    if (usesCadtWindows && cslCaptureEvaluationComplete && !acceptedThisInference) {
        clearHandCache();
        prepareForNextCapture();
    }
}

function inferStaticCslFallback() {
    const ranked = predictStaticCsl(cslStaticModel, latestCslStaticHands);
    const bestMatch = ranked[0];
    if (!bestMatch || bestMatch.confidence < CSL_STATIC_CONFIDENCE_THRESHOLD) {
        showDynamicIdle(bestMatch?.confidence || 0, false);
        return;
    }

    showDynamicMatch(bestMatch.word, bestMatch.confidence);
    if (bestMatch.word === lastDynamicGuess) {
        dynamicSignStreak++;
    } else {
        lastDynamicGuess = bestMatch.word;
        dynamicSignStreak = 1;
    }

    if (dynamicSignStreak < 4) return;
    acceptDynamicWord(ranked.slice(0, 3).map(({ word, confidence }) => ({
        word,
        conf: confidence
    })));
    dynamicSignStreak = 0;
    motionBuffer = [];
    clearHandCache({ preserveReleaseGate: true });
    showDynamicIdle(0, true);
}

function updateLetterConsensus(history, letter, score, maxFrames = 5) {
    const next = Array.isArray(history) ? history.slice() : [];
    if (letter) next.push({ letter, score: Number(score) || 0 });
    while (next.length > maxFrames) next.shift();
    const totals = new Map();
    for (const vote of next) {
        const current = totals.get(vote.letter) || { count: 0, score: 0 };
        current.count++;
        current.score += vote.score;
        totals.set(vote.letter, current);
    }
    const ranked = [...totals.entries()].sort((a, b) =>
        b[1].count - a[1].count || b[1].score - a[1].score
    );
    const [winner, winnerData] = ranked[0] || [null, { count: 0, score: 0 }];
    return {
        history: next,
        letter: winner,
        score: winnerData.count ? winnerData.score / winnerData.count : 0,
        stable: next.length >= 3 && winnerData.count >= 3
    };
}

// Fingerpose runs locally in the browser. A short majority vote prevents one
// noisy MediaPipe frame from changing the displayed/accepted letter.
function inferStaticGesture(hand, timestamp = performance.now()) {
    dynamicSignStreak = 0;
    const fpGuess = evaluateFingerPose(hand);
    const predictedLetter = fpGuess ? refineGeometricEdges(fpGuess.name, hand) : null;

    if (fpGuess && predictedLetter) {
        const consensus = updateLetterConsensus(staticLetterVotes, predictedLetter, fpGuess.score);
        staticLetterVotes = consensus.history;
        const adjustedLetter = consensus.letter || predictedLetter;
        if (!consensus.stable) {
            staticHoldElapsedMs = 0;
            staticHoldLastTickAt = timestamp;
            showStaticCandidatePending(consensus.score || fpGuess.score, 0);
            return;
        }

        if (adjustedLetter === lastStaticGuess) {
            staticSignStreak++;
            staticHoldElapsedMs = Math.min(
                STATIC_HOLD_DURATION_MS,
                staticHoldElapsedMs + timerDelta(timestamp)
            );
        } else {
            lastStaticGuess = adjustedLetter;
            staticSignStreak = 1;
            staticHoldElapsedMs = 0;
            staticHoldLastTickAt = timestamp;
        }

        const holdProgress = staticHoldElapsedMs / STATIC_HOLD_DURATION_MS;
        if (holdProgress < STATIC_PREVIEW_REVEAL_PROGRESS) {
            showStaticCandidatePending(consensus.score || fpGuess.score, holdProgress);
        } else {
            showStaticMatch(adjustedLetter, consensus.score || fpGuess.score, holdProgress);
        }

        if (holdProgress >= 1) {
            acceptStaticLetter(adjustedLetter);
        }
    } else {
        staticLetterVotes = [];
        resetStaticUI(timestamp);
    }
}

// Fingerpose gets confused between similar hand shapes, so retain the original
// browser-only landmark geometry corrections used before the RGB model.
function refineGeometricEdges(currentGuess, hand) {
    let corrected = currentGuess;

    if (['Y', 'I'].includes(corrected)) {
        const leftHanded = hand[5].x > hand[17].x;
        const thumbSideOffset = leftHanded ? (hand[4].x - hand[5].x) : (hand[5].x - hand[4].x);
        corrected = thumbSideOffset > 0.045 ? 'Y' : 'I';
    }

    if (['U', 'V', 'R', 'P', 'H', 'K'].includes(corrected)) {
        const dx = Math.abs(hand[8].x - hand[5].x);
        const dy = Math.abs(hand[8].y - hand[5].y);
        if (hasCrossedIndexMiddle(hand)) {
            corrected = 'R';
        } else if (dx > dy * 1.2) {
            corrected = 'H';
        } else if (hand[8].y > hand[5].y) {
            corrected = 'P';
        } else {
            const fingerGap = calculateDistance(hand[8], hand[12]);
            const baseGap = calculateDistance(hand[5], hand[9]);
            if (fingerGap < baseGap * 1.4) {
                corrected = 'U';
            } else {
                const leftHanded = hand[5].x > hand[17].x;
                let tX = hand[4].x, iX = hand[5].x, mX = hand[9].x;
                if (leftHanded) { tX = -tX; iX = -iX; mX = -mX; }
                corrected = hand[4].y < hand[9].y - 0.01 && tX > iX && tX < mX ? 'K' : 'V';
            }
        }
    }

    if (['D', 'Q', 'L', 'G'].includes(corrected)) {
        const dx = Math.abs(hand[8].x - hand[5].x);
        const dy = Math.abs(hand[8].y - hand[5].y);
        if (dx > dy * 1.2) {
            corrected = 'G';
        } else if (hand[8].y > hand[5].y) {
            corrected = 'Q';
        } else {
            const width = calculateDistance(hand[5], hand[17]);
            const thumbExtension = calculateDistance(hand[4], hand[5]);
            corrected = thumbExtension > width * 0.7 ? 'L' : 'D';
        }
    }

    if (['C', 'O', 'F'].includes(corrected)) {
        const middleIsUp = hand[12].y < hand[10].y;
        if (middleIsUp) {
            corrected = 'F';
        } else {
            const pinchGap = calculateDistance(hand[8], hand[4]);
            const knuckleWidth = calculateDistance(hand[5], hand[6]);
            corrected = pinchGap < knuckleWidth ? 'O' : 'C';
        }
    }

    if (['A', 'E', 'S', 'T', 'M', 'N'].includes(corrected)) {
        corrected = classifyClosedThumbLetter(hand);
    }

    return corrected;
}

function showDynamicMatch(word, confidence) {
    const percent = Math.round(confidence * 100);
    if (currentTrackingMode === "csl_word") lastCslTopGuessDiagnostic = null;
    confidenceProgressBar.style.width = percent + "%";
    confidenceProgressBar.style.background = "lime";
    confidencePctDisplay.innerText = percent + "%";
    guessLabelDisplay.innerText = "Motion: " + word;
}

function showCslTrackingUncertain() {
    if (!lastCslTopGuessDiagnostic) {
        guessLabelDisplay.innerText = "Motion: KSL not confident — tracking hands…";
        confidencePctDisplay.innerText = "—";
    }
    rawExtractionDisplay.innerText = "KSL not confident: briefly lost hand tracking; keeping the current capture.";
    confidenceProgressBar.style.background = "gray";
    const config = resolveCslRuntimeConfig(activeModelMetadata);
    setCaptureGuide(
        "waiting",
        "KSL not confident",
        "Keep your hands visible. The current capture is preserved briefly.",
        cadtCslHandBuffer.length / config.captureFrameCount
    );
}

function showCslRejectedPrediction({
    bestMatch,
    secondMatch,
    topTwoMargin,
    requiredMargin,
    confidenceThreshold,
    staticAgreement
}) {
    const bestPercent = Math.round(bestMatch.conf * 100);
    const secondPercent = Math.round(secondMatch.conf * 100);
    const marginPercent = Math.round(topTwoMargin * 100);
    const requiredMarginPercent = Math.round(requiredMargin * 100);
    const thresholdPercent = Math.round(confidenceThreshold * 100);
    const reasons = [];
    if (bestMatch.conf <= confidenceThreshold) reasons.push(`confidence must exceed ${thresholdPercent}%`);
    if (topTwoMargin < requiredMargin) reasons.push(`margin must reach ${requiredMarginPercent}%`);
    if (!reasons.length) reasons.push("prediction was not stable");

    const diagnosticText = [
        `Motion: KSL not confident — best ${bestMatch.word}`,
        `next ${secondMatch.word} ${secondPercent}%`,
        `margin ${marginPercent}%/${requiredMarginPercent}%`,
        `rejected: ${reasons.join(" and ")}`,
        staticAgreement ? "static handshape agreed" : "no static agreement"
    ].join(" · ");
    lastCslTopGuessDiagnostic = { text: diagnosticText, percent: bestPercent };

    confidenceProgressBar.style.width = bestPercent + "%";
    confidenceProgressBar.style.background = "gray";
    confidencePctDisplay.innerText = bestPercent + "%";
    guessLabelDisplay.innerText = diagnosticText;
    rawExtractionDisplay.innerText = "KSL capture rejected; details remain in Top Guess.";
}

function showDynamicLetterPending() {
    confidenceProgressBar.style.width = "0%";
    confidenceProgressBar.style.background = "gray";
    confidencePctDisplay.innerText = "—";
    guessLabelDisplay.innerText = "Motion: Detecting…";
    setCaptureGuide(
        "capturing",
        "Following the movement",
        "Complete the motion, then relax your hand.",
        0
    );
}

function showDynamicIdle(confidence, isUserIdle) {
    dynamicSignStreak = 0;
    lastDynamicGuess = "";

    const percent = Math.round(confidence * 100);
    confidenceProgressBar.style.width = isUserIdle ? percent + "%" : "0%";
    confidenceProgressBar.style.background = "gray";
    guessLabelDisplay.innerText = isUserIdle ? "Motion: Idle" : "Swaying...";
    confidencePctDisplay.innerText = isUserIdle ? percent + "%" : "0%";
}

function showStaticMatch(letter, score, holdProgress) {
    // Score out of 10 from fingerpose
    const percent = Math.round((score / 10) * 100);
    const holdPercent = Math.round(holdProgress * 100);
    confidenceProgressBar.style.width = percent + "%";
    confidenceProgressBar.style.background = "cyan";
    guessLabelDisplay.innerText = `Pose: ${letter} (Hold: ${holdPercent}%)`;
    confidencePctDisplay.innerText = percent + "%";
    setCaptureGuide(
        "holding",
        `Hold ${letter} steady`,
        "Keep the handshape still until the bar is full.",
        holdProgress
    );
}

function showStaticCandidatePending(score, holdProgress) {
    const percent = Math.round((score / 10) * 100);
    confidenceProgressBar.style.width = percent + "%";
    confidenceProgressBar.style.background = "cyan";
    confidencePctDisplay.innerText = percent + "%";
    guessLabelDisplay.innerText = "Pose: Checking…";
    setCaptureGuide(
        "holding",
        "Checking handshape",
        "Hold still briefly while Dexter confirms the letter.",
        holdProgress
    );
}

function resetStaticUI(timestamp = performance.now()) {
    const remainingProgress = decayStaticHold(timestamp);
    staticSignStreak = 0;
    confidenceProgressBar.style.width = "0%";
    guessLabelDisplay.innerText = "Pose: None";
    confidencePctDisplay.innerText = "0%";
    if (!staticAwaitingRelease) {
        rawExtractionDisplay.innerText = "...";
    }
    if (remainingProgress > 0 && lastStaticGuess) {
        setCaptureGuide(
            "holding",
            `Steady ${lastStaticGuess}`,
            "The timer is paused briefly while Dexter finds the handshape again.",
            remainingProgress
        );
    } else {
        showWaitingForInputGuide();
    }
}

// rebuild the accumulated word string from whatever is actually in the DOM
function syncSentenceState() {
    let text = "";
    Array.from(sentenceBuilderDisplay.childNodes).forEach(node => {
        if (node.tagName === 'SELECT') {
            text += node.value + " ";
        } else if (node.tagName === 'SPAN') {
            text += node.innerText;
        } else if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
        }
    });
    accumulatedWord = text.replace(/\s+/g, ' ').trim();
}

function acceptStaticLetter(letter) {
    setCaptureActive(false);
    rawExtractionDisplay.innerText = letter;

    if (letter.trim().toLowerCase() !== "idle") {
        const charSpan = document.createElement('span');
        charSpan.className = "static-letter";
        charSpan.innerText = letter;
        sentenceBuilderDisplay.appendChild(charSpan);
        syncSentenceState();
    }

    staticAwaitingRelease = true;
    acceptedStaticLetter = letter;
    acceptedStaticSignature = normalizeHandShapeSignature(latestHandSignature);
    staticReleaseStartedAt = null;
    resetStaticHoldTimer();
    setCaptureGuide(
        "accepted",
        `${letter} accepted`,
        "Release or change your hand to continue.",
        1
    );
}

function acceptDynamicWord(
    options,
    releaseSignature = latestHandSignature,
    { lockRecognition = true, requireShapeChange = false } = {}
) {
    const primaryWord = options[0].word;
    rawExtractionDisplay.innerText = primaryWord;

    const dropdown = document.createElement('select');
    dropdown.className = "ai-correction-dropdown";

    // make it look like regular text until you click on it
    Object.assign(dropdown.style, {
        border: "none",
        background: "transparent",
        fontFamily: "inherit",
        fontSize: "inherit",
        color: "var(--text-color, inherit)",
        cursor: "pointer",
        outline: "none",
        textDecoration: "underline dashed gray"
    });


    options.forEach(choice => {
        const optionEl = document.createElement('option');
        optionEl.value = choice.word;
        optionEl.dataset.conf = Math.round(choice.conf * 100);
        optionEl.innerText = choice.word;
        dropdown.appendChild(optionEl);
    });

    // show confidence % when the dropdown is open so you can pick the right one
    dropdown.addEventListener('focus', function () {
        Array.from(this.options).forEach(opt => opt.innerText = `${opt.value} (${opt.dataset.conf}%)`);
    });

    dropdown.addEventListener('blur', function () {
        Array.from(this.options).forEach(opt => opt.innerText = opt.value);
    });

    dropdown.addEventListener('change', function () {
        Array.from(this.options).forEach(opt => opt.innerText = opt.value);
        this.blur();
        syncSentenceState();
    });

    sentenceBuilderDisplay.appendChild(dropdown);
    sentenceBuilderDisplay.appendChild(document.createTextNode(" "));

    syncSentenceState();
    if (lockRecognition) {
        if (currentTrackingMode === "asl_letter") {
            lockDynamicLetterRecognition(primaryWord, releaseSignature);
        }
        else lockWordRecognition(primaryWord, releaseSignature, { requireShapeChange });
    }
}

function resetInactivity() {
    const timestamp = performance.now();
    if (dynamicLetterAwaitingRelease) {
        updateDynamicLetterRelease({ landmarks: [] }, timestamp);
        if (dynamicLetterAwaitingRelease) return;
    }
    if (wordAwaitingRelease) {
        updateWordRelease({ landmarks: [] }, timestamp);
        if (wordAwaitingRelease) return;
    }
    if (staticAwaitingRelease) {
        updateStaticRelease({ landmarks: [] }, timestamp);
        if (staticAwaitingRelease) return;
    }

    motionBuffer = [];
    cadtCslHandBuffer = [];
    pauseCadtCslSampler();
    motionTimestampBuffer = [];
    wlaslFrameBuffer = [];
    lastWlaslInferenceAt = 0;
    predictionVotes = [];
    wristVelocityBuffer = [];
    dynamicSignStreak = 0;
    resetStaticHoldTimer();
    rawExtractionDisplay.innerText = (currentTrackingMode === "asl_word" || currentTrackingMode === "csl_word")
        ? "Waiting for hands…"
        : "...";
    confidenceProgressBar.style.width = "0%";

    if (currentTrackingMode === "csl_word" && lastCslTopGuessDiagnostic) {
        guessLabelDisplay.innerText = lastCslTopGuessDiagnostic.text;
        confidencePctDisplay.innerText = lastCslTopGuessDiagnostic.percent + "%";
        confidenceProgressBar.style.width = lastCslTopGuessDiagnostic.percent + "%";
        confidenceProgressBar.style.background = "gray";
    } else if (currentTrackingMode === "asl_word" || currentTrackingMode === "csl_word") {
        guessLabelDisplay.innerText = "Waiting for input... [Ready]";
        confidencePctDisplay.innerText = "0%";
    } else {
        guessLabelDisplay.innerText = "None";
        confidencePctDisplay.innerText = "0%";
    }
    setCaptureActive(false);
    showWaitingForInputGuide();
}

// Next.js renders the controls without inline event attributes. Bind the same
// global handlers after this client-only module has initialized.
cameraToggleBtn.onclick = window.startCam;
document.getElementById('modeDropdownButton')?.addEventListener('click', window.toggleDropdown, { signal: listeners.signal });
document.querySelectorAll('[data-mode-id]').forEach(item => {
    item.addEventListener('click', () => {
        window.selectMode(item.dataset.modeId, item.dataset.modeLabel, item);
    }, { signal: listeners.signal });
});
document.getElementById('flipCameraBtn')?.addEventListener('click', window.flipCam, { signal: listeners.signal });
document.getElementById('backspaceWordBtn')?.addEventListener('click', window.backspaceWord, { signal: listeners.signal });
document.getElementById('clearWordBtn')?.addEventListener('click', window.clearWord, { signal: listeners.signal });
document.getElementById('translateSentenceBtn')?.addEventListener('click', window.translateSentence, { signal: listeners.signal });
document.getElementById('speakTranslationBtn')?.addEventListener('click', window.speakTranslation, { signal: listeners.signal });

cameraToggleBtn.disabled = false;
cameraToggleBtn.textContent = "Start Camera";
void ensureModelsReady().catch(error => {
    if (!disposed && !startingCamera) setCaptureGuide("off", "Recognition unavailable", "Check your connection, then try Start Camera again.", 0);
    console.error("Recognition initialization failed", error);
});
const stopCamera = window.stopCam;
return () => {
    disposed = true;
    listeners.abort();
    stopCamera();
    cancelTranslationSpeech();
    cameraToggleBtn.onclick = null;
    if (pauseToggleBtn) pauseToggleBtn.onclick = null;
    // Wait for in-flight model loads before releasing their GPU resources.
    Promise.allSettled([modelInitPromise, modeConfiguration, ...modeLoads.values()]).then(() => {
        handTracker?.close();
        poseTracker?.close();
        for (const model of new Set([aslModel, aslWordModel, cslModel, wlaslModel])) model?.dispose();
    });
};
}
