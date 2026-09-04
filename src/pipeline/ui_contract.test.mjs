import assert from "node:assert/strict";
import fs from "node:fs";

const headerMarkup = fs.readFileSync(new URL("../../components/Header.js", import.meta.url), "utf8");
const translatorMarkup = fs.readFileSync(new URL("../../components/Translator.js", import.meta.url), "utf8");
const learnMarkup = fs.readFileSync(new URL("../../components/Learn.js", import.meta.url), "utf8");
const translatorHtml = `${headerMarkup}\n${translatorMarkup}`;
const translatorScript = fs.readFileSync(new URL("../../client/translator.js", import.meta.url), "utf8");
const translatorStyles = fs.readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const learnScript = fs.readFileSync(new URL("../../client/learn.js", import.meta.url), "utf8");
const dictionarySource = fs.readFileSync(new URL("../../client/sign-dictionary.js", import.meta.url), "utf8");

for (const [name, markup] of [["translator", translatorHtml], ["learn", `${headerMarkup}\n${learnMarkup}`]]) {
  const ids = [...markup.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${name} page contains duplicate element IDs.`);
}

assert.match(translatorHtml, /id=["']captureCountdown["']/, "Translator must expose the pre-capture countdown.");
assert.doesNotMatch(translatorHtml, /id=["']cslStageSelect["']/, "CSL must use one fixed recognition pipeline without a stage selector.");
assert.match(translatorScript, /CAPTURE_COUNTDOWN_STEP_MS\s*=\s*300/, "Countdown numbers must advance every 300 ms.");
assert.match(translatorScript, /STATIC_HOLD_DURATION_MS\s*=\s*260/, "Static letters must not require a long hold.");
assert.match(translatorScript, /STATIC_RELEASE_DURATION_MS\s*=\s*160/, "Different letters must rearm quickly.");
assert.match(translatorScript, /MIN_CAPTURE_HAND_CONFIDENCE\s*=\s*0\.65/, "Landmark modes must require reliable hand tracking.");
assert.match(translatorScript, /letterSessionCountdownComplete/, "ASL Letters must remember its one session countdown.");
assert.match(translatorScript, /gestureEstimator\.estimate/, "ASL Letters must use the browser-only Fingerpose classifier.");
assert.match(translatorScript, /classifyClosedThumbLetter/, "Closed-fist ASL letters must use palm-relative thumb slots.");
assert.match(translatorScript, /hasCrossedIndexMiddle/, "R must be detected from crossed-finger geometry before orientation routing.");
assert.doesNotMatch(translatorScript, /predict-letter/, "ASL Letters must not depend on the Python inference backend.");
assert.doesNotMatch(translatorScript, /canonicalizeHandLandmarks|classifyClosedFistThumb/, "Static letters must not use landmark geometry rules.");
assert.doesNotMatch(translatorHtml, /onnxruntime|ort\.min\.js/, "ASL Letters must not load a second inference runtime.");
assert.match(
  translatorScript,
  /getAslDynamicLetterIntent/,
  "J/Z model routing must use letter-specific motion intent instead of cumulative jitter."
);
assert.match(translatorScript, /DYNAMIC_LETTER_REQUIRED_HITS\s*=\s*4/, "J/Z must use four confirmation hits.");
assert.match(
  translatorScript,
  /hasEmergingAslLetterMotion\(recentFrames\)/,
  "Emerging J/Z fingertip motion must suppress temporary static-letter guesses."
);
assert.match(
  translatorScript,
  /Motion: Detecting…/,
  "Unresolved dynamic letters must use a label-neutral UI state."
);
assert.match(
  translatorScript,
  /Pose: Checking…/,
  "Unconfirmed static guesses must not display a potentially incorrect letter."
);
assert.match(
  translatorScript,
  /lockDynamicLetterRecognition\(primaryWord,\s*releaseSignature\)/,
  "Accepted J/Z letters must enter the dynamic-letter release gate."
);
assert.match(
  translatorScript,
  /handSignatureDistance\(acceptedDynamicSignature,\s*currentSignature\)\s*>=\s*STATIC_RELEASE_SHAPE_THRESHOLD/,
  "J/Z release must accept a changed handshape without requiring the hand to leave the frame."
);
assert.match(
  translatorScript,
  /const visualOnly\s*=\s*currentTrackingMode\s*===\s*["']asl_word["']/,
  "The ASL-word countdown must be visual-only."
);
assert.match(
  translatorScript,
  /const isWordMode\s*=\s*currentTrackingMode\s*===\s*["']asl_word["']\s*\|\|\s*currentTrackingMode\s*===\s*["']csl_word["']/,
  "ASL and CSL Words must share one countdown presentation."
);
assert.doesNotMatch(
  translatorScript,
  /Recognition active\s*·/,
  "ASL Words must not use a different countdown label from CSL Words."
);
assert.match(
  translatorScript,
  /\|\| !latestHandsVisible\s*\n\s*\) return;/,
  "Every visible countdown, including ASL Words, must wait for tracked hands."
);
assert.match(
  translatorScript,
  /if \(!latestHandsVisible\) \{\s*if \(captureCountdownTimer\) cancelCaptureCountdown\(\);[\s\S]{0,160}showWaitingForInputGuide\(\);/,
  "ASL Words must cancel its visual timer and return to waiting when idle."
);
assert.match(translatorScript, /lockRecognition:\s*false/, "WLASL results must not use the timer-test hand release gate.");
assert.doesNotMatch(
  translatorScript,
  /Start the WLASL service on port 8001/,
  "Hosted backend errors must not tell production visitors to start a localhost port."
);
assert.match(translatorScript, /predictCadtCslWindows/, "CSL must average bounded shifted capture windows.");
assert.doesNotMatch(translatorHtml, /value=["']short["']/, "The unreliable short CSL mode must not be offered.");
assert.match(translatorScript, /interpolateCadtCslFrame/, "CSL capture must maintain a 30-sample-per-second landmark timeline.");
assert.match(translatorScript, /showCslRejectedPrediction/, "Rejected CSL predictions must explain confidence and margin failures.");
assert.match(translatorScript, /lastCslTopGuessDiagnostic/, "The latest rejected CSL prediction must persist in Top Guess.");
assert.doesNotMatch(translatorScript, /window\.selectCslStage\s*=\s*function/, "CSL must not expose obsolete runtime-stage switching.");
assert.match(translatorScript, /findStaticAgreement/, "Static CSL may assist only through explicit label agreement.");
assert.doesNotMatch(
  translatorScript,
  /currentTrackingMode\s*===\s*["']csl_word["'][\s\S]{0,80}ensurePoseTracker\(\)/,
  "CSL must not initialize the body-pose tracker."
);
assert.match(
  translatorScript,
  /if \(currentTrackingMode === ["']asl_word["'] && poseTracker\)/,
  "Pose detection must remain isolated to the optional ASL landmark path."
);
assert.doesNotMatch(translatorScript, /if \(!captureIsActive \|\| !wlaslBackendReady/, "Countdown state must not gate ASL-word recording.");
assert.match(translatorScript, /if \(visualOnly\) return;/, "ASL-word countdown completion must not clear recognition state.");
assert.match(
  translatorScript,
  /shouldSubmitAslWordClip\(\{ clipSize: clip\.size, trackedHandFrames \}\)/,
  "ASL Words must reject clips that contain no sustained hand tracking before inference."
);
assert.match(
  translatorScript,
  /else if \(latestHandsVisible\) \{\s*analyzeMovement\(detectedHands, detectedPose, currentTimeMs\);/,
  "Landmark word recognition, including CSL, must never analyze pose-only frames."
);
assert.match(translatorScript, /if \(!captureIsActive\)/, "Frame processing must be gated until capture starts.");
assert.match(translatorStyles, /\.video-container\.is-dimmed::after/, "Inactive camera states must be visibly dimmed.");
assert.match(
  translatorStyles,
  /@media screen and \(max-width: 800px\)[\s\S]*?\.dex-main\s*\{[\s\S]*?padding:\s*12px 8px calc\(48px \+ env\(safe-area-inset-bottom, 0px\)\);/,
  "Mobile layout must leave safe-area-aware breathing room below the final card."
);
assert.match(
  translatorScript,
  /width:\s*\{ ideal: 1280 \}[\s\S]{0,160}height:\s*\{ ideal: 960 \}[\s\S]{0,160}aspectRatio:\s*\{ ideal: 4 \/ 3 \}/,
  "Mobile camera capture must request a high-resolution 4:3 feed."
);
assert.match(
  translatorScript,
  /MOBILE_DETECTION_INTERVAL_MS\s*=\s*1000 \/ 15/,
  "Higher-resolution mobile capture must retain the existing 15 FPS inference budget."
);
assert.match(
  translatorScript,
  /isMobileDevice && currentTimeMs - lastDetectionAt < MOBILE_DETECTION_INTERVAL_MS/,
  "Mobile frame processing must be throttled independently from preview quality."
);
assert.match(
  translatorStyles,
  /\.capture-guide\s*\{[\s\S]*?background:\s*#f8f9fa;/,
  "The camera guidance bar must use the light palette by default."
);
assert.match(
  translatorStyles,
  /\.capture-guide\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*8px;[\s\S]*?box-shadow:\s*none;/,
  "The camera guidance bar must share the flat depth and radius of the confidence panel."
);
assert.match(
  translatorStyles,
  /body\.dark-mode \.capture-guide\s*\{[\s\S]*?background:\s*#3c4043;/,
  "The camera guidance bar must share the confidence panel's dark surface in dark mode."
);
assert.match(
  translatorScript,
  /const wordModeIsIdle\s*=\s*\(currentTrackingMode\s*===\s*["']asl_word["']\s*\|\|\s*currentTrackingMode\s*===\s*["']csl_word["']\)/,
  "ASL and CSL word modes must both dim the camera when no hands are visible."
);
assert.match(
  translatorScript,
  /latestHandsVisible\s*=\s*hasVisibleHandLandmarks\(detectedHands\);\s*syncCameraCaptureAppearance\(\);/,
  "Camera dimming must update immediately after each hand-presence check."
);
assert.match(translatorHtml, /id=["']speakTranslationBtn["']/, "Translator must expose a final-translation speech control.");
assert.match(translatorHtml, /id=["']speechLanguageSelect["']/, "Translator must expose a speech-language selector.");
assert.match(translatorHtml, /id=["']speechStatus["']/, "Translator must expose speech playback status.");
assert.match(translatorHtml, /<option value=["']khmer["']>Khmer<\/option>/, "Speech selector must offer Khmer.");
assert.match(translatorHtml, /<option value=["']english["']>English<\/option>/, "Speech selector must offer English.");
assert.match(translatorHtml, /id=["']khmerTranslation["'][^>]+lang=["']km["']/, "Final translation must expose a Khmer result.");
assert.match(translatorHtml, /id=["']englishTranslation["'][^>]+lang=["']en["']/, "Final translation must expose an English result.");
assert.match(translatorScript, /new SpeechSynthesisUtterance\(speechItem\.text\)/, "Speech must use each final interpreted text.");
assert.match(translatorScript, /lang:\s*["']km-KH["']/, "Khmer speech must use the Khmer locale.");
assert.match(translatorScript, /lang:\s*["']en-US["']/, "English speech must use the English locale.");
assert.match(translatorScript, /getSelectedSpeakableTranslation\(\)/, "Speech must use the selected translation language.");
assert.doesNotMatch(translatorScript, /speakTranslationAtIndex/, "Speech must not automatically read both translations in sequence.");
assert.match(translatorScript, /speechItem\.id === ["']khmer["']/, "Khmer speech must use generated audio rather than an optional system voice.");
assert.match(translatorScript, /new Audio\(`\/api\/speech\?/, "Generated speech must play through the same-origin speech endpoint.");
assert.match(translatorScript, /\{ speakable: hasBilingualTranslation \}/, "Only a complete bilingual interpretation may enable speech.");
assert.match(translatorHtml, /id=["']backspaceWordBtn["']/, "Translator must expose a backspace control.");
assert.match(translatorScript, /backspaceWordBtn[^\n]+window\.backspaceWord/, "Backspace control must bind its handler.");
assert.match(translatorScript, /window\.backspaceWord\s*=\s*function/, "Backspace control must have a callable handler.");
assert.match(translatorScript, /sentenceBuilderDisplay\.lastChild\?\.remove\(\)/, "Backspace must remove the latest recognized item.");
assert.match(learnScript, /card\.remove\(\)/, "Learn cards must disappear when every image candidate fails.");
assert.doesNotMatch(learnScript, /Reference image unavailable/, "Learn must not display obsolete pictureless cards.");
assert.match(learnScript, /item\.type === 'video'/, "SignDex must render motion-based sign references as video.");
assert.match(learnScript, /\? 'Word'/, "Motion-based sign cards must be labeled as words instead of videos.");
assert.match(dictionarySource, /aslAlphabet/, "The SignDex catalog must include the full ASL fingerspelling alphabet.");
assert.match(dictionarySource, /const cslWords/, "The SignDex catalog must retain the original CSL words.");
assert.match(dictionarySource, /images\/csl\/reference/, "The original CSL reference photos must remain available.");
assert.match(learnMarkup, /id=["']signSearch["'][\s\S]*type=["']search["']/, "SignDex must expose a sign search field.");
assert.match(learnMarkup, /id=["']categoryFilter["']/, "SignDex must expose a category filter.");
assert.match(learnMarkup, /id=["']searchResultsStatus["'][\s\S]*aria-live=["']polite["']/, "Sign search must announce result counts.");
assert.match(learnMarkup, /id=["']dictionaryEmptyState["']/, "Sign search must expose an empty state.");
assert.doesNotMatch(learnMarkup, /id=["']flashcardToggle["'][^>]+defaultChecked/, "Flashcard mode must be off by default.");
assert.match(learnMarkup, /className=["']dictionary-grid["'] id=["']dictGrid["']/, "SignDex must initially render in normal image mode.");
assert.match(learnScript, /normalizeSearchValue\(searchableText\)\.includes\(normalizedQuery\)/, "Sign search must filter normalized labels.");
assert.match(learnScript, /event\.key !== 'Escape'/, "Escape must clear sign search.");

console.log("UI contracts passed: unique IDs, Next.js controls, and client handlers are present.");
