import Header from "./Header";
import { getSessionAccount } from "../lib/auth";
import { hasProAccess } from "../lib/plans";

export default async function Translator() {
  const account = await getSessionAccount();
  const canUseSpeech = hasProAccess(account);

  return (
    <>
      <Header activePage="translate" />
      <main className="dex-main">
        <h1 className="sr-only">Real-time sign language translator</h1>
        <div className="dex-card-container">
          <section className="dex-box" aria-label="Sign language camera input">
            <div className="dex-box-header">
              <div className="custom-dropdown" id="modeDropdown">
                <button id="modeDropdownButton" className="dex-lang-tab active custom-dropdown-btn">
                  <span id="currentModeLabel">ASL Spelling</span>
                  <svg
                    focusable="false"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    width="18px"
                    height="18px"
                    style={{ marginLeft: "4px", pointerEvents: "none", verticalAlign: "middle" }}
                  >
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
                <div className="custom-dropdown-content" id="modeMenu">
                  <div className="dropdown-item active" data-mode-id="asl_letter" data-mode-label="ASL Spelling">
                    ASL Spelling
                  </div>
                  <div className="dropdown-item" data-mode-id="asl_word" data-mode-label="ASL Words">
                    ASL Words
                  </div>
                  <div className="dropdown-item" data-mode-id="csl_word" data-mode-label="CSL Words">
                    CSL Words
                  </div>
                </div>
              </div>
            </div>
            <div className="dex-box-content">
              <div className="video-container">
                <video id="webcamFeed" autoPlay playsInline muted />
                <canvas className="overlayCanvas" />
                <div
                  id="captureCountdown"
                  className="capture-countdown"
                  aria-live="assertive"
                  aria-atomic="true"
                  hidden
                >
                  <span id="captureCountdownNumber">3</span>
                  <small>Capture starts</small>
                </div>
              </div>

              <div
                id="captureGuide"
                className="capture-guide"
                data-state="off"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="capture-guide-heading">
                  <span className="capture-guide-indicator" aria-hidden="true" />
                  <span id="captureStateLabel">Camera off</span>
                </div>
                <div id="captureStateDetail" className="capture-guide-detail">
                  Start the camera when you are ready.
                </div>
                <div
                  id="captureProgressTrack"
                  className="capture-progress-track"
                  role="progressbar"
                  aria-label="Sign capture progress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow="0"
                >
                  <div id="captureProgressBar" className="capture-progress-bar" />
                </div>
              </div>

              <div className="debug-panel">
                <div className="debug-text">
                  Top Guess: <span id="guessLabel">None</span> (<span id="confidencePct">0%</span>)
                </div>
                <div className="bar-container">
                  <div id="confidenceBar" />
                </div>
              </div>
            </div>
            <div className="dex-box-footer">
              <div className="dex-controls-left">
                <button id="cameraBtn" className="dex-btn-primary">
                  Start Camera
                </button>
                <button
                  id="pauseBtn"
                  className="dex-btn-primary"
                  style={{ display: "none", marginLeft: "8px" }}
                >
                  Pause Camera
                </button>
                <button id="flipCameraBtn" className="dex-icon-btn" title="Flip Camera">
                  <svg
                    focusable="false"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="#5f6368"
                    width="24px"
                    height="24px"
                  >
                    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                  </svg>
                </button>
              </div>
            </div>
          </section>

          <section className="dex-box output-box" aria-label="Sign language translation output">
            <div className="dex-box-header">
              <div className="dex-lang-tab active" id="outputLangLabel">
                Khmer + English
              </div>
              <div className="output-header-actions">
                <button
                  id="backspaceWordBtn"
                  className="dex-icon-btn backspace-btn"
                  title="Remove latest letter or word"
                  aria-label="Remove latest letter or word"
                >
                  <svg
                    focusable="false"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="#5f6368"
                    width="24px"
                    height="24px"
                  >
                    <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.12c.36.53.9.88 1.59.88h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z" />
                  </svg>
                </button>
                <button
                  id="clearWordBtn"
                  className="dex-icon-btn clear-btn"
                  title="Clear translation"
                  aria-label="Clear translation"
                >
                  <svg
                    focusable="false"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="#5f6368"
                    width="24px"
                    height="24px"
                  >
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="dex-box-content dex-output-content">
              <div className="translation-wrapper">
                <div id="liveOutput" className="live-translation">
                  ...
                </div>
                <div className="word-panel">
                  <div id="builtSentence" className="extracted-word" />
                  <div id="translatedResult" className="final-translation" aria-live="polite">
                    <div id="translationStatus" />
                    <div id="bilingualTranslation" className="bilingual-translation" hidden>
                      <div className="translation-row">
                        <span className="translation-language">Khmer</span>
                        <span id="khmerTranslation" lang="km" />
                      </div>
                      <div className="translation-row">
                        <span className="translation-language">English</span>
                        <span id="englishTranslation" lang="en" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="dex-box-footer output-footer">
              <button id="translateSentenceBtn" className="dex-btn-translate">
                Interpret Context
              </button>
              <div
                id="speechControls"
                className="speech-controls"
                role="group"
                aria-label="Text to speech controls"
                data-pro-enabled={canUseSpeech ? "true" : "false"}
              >
                <span id="speechStatus" className="speech-status" role="status" aria-live="polite" />
                {!canUseSpeech && <a className="speech-pro-link" href="/pricing">Pro</a>}
                <select
                  id="speechLanguageSelect"
                  className="speech-language-select"
                  aria-label="Speech language"
                  title="Choose speech language"
                  disabled
                  defaultValue="khmer"
                >
                  <option value="khmer">Khmer</option>
                  <option value="english">English</option>
                </select>
                <button
                  id="speakTranslationBtn"
                  type="button"
                  className="dex-icon-btn dex-speech-btn"
                  title="Speak Khmer translation"
                  aria-label="Speak Khmer translation"
                  disabled
                >
                  <svg
                    focusable="false"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="24px"
                    height="24px"
                  >
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zm0-7.71v2.06a7 7 0 0 1 0 11.3v2.06a9 9 0 0 0 0-15.42z" />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
