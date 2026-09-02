import Header from "./Header";

export default function Learn({ initialLanguage }) {
  const isCsl = initialLanguage === "csl";

  return (
    <>
      <Header activePage="learn" />
      <main className="dex-main">
        <div className="dictionary-container">
          <div className="dictionary-header">
            <div className="dictionary-heading">
              <div className="dictionary-title-row">
                <h1 className="dictionary-title">SignDex</h1>
                <div
                  className="dictionary-language-indicator"
                  id="languageIndicator"
                  role="status"
                  aria-live="polite"
                >
                  <span id="activeLanguageCode">{isCsl ? "CSL" : "ASL"}</span>
                </div>
              </div>
              <label className="flashcard-switch-wrapper">
                <div className="custom-switch">
                  <input type="checkbox" id="flashcardToggle" />
                  <span className="slider" />
                </div>
                Flashcard Mode
              </label>
            </div>
            <div className="dictionary-tabs">
              <button
                className={`dict-tab${isCsl ? "" : " active"}`}
                id="tab-asl"
                aria-pressed={isCsl ? "false" : "true"}
              >
                ASL
              </button>
              <button
                className={`dict-tab${isCsl ? " active" : ""}`}
                id="tab-csl"
                aria-pressed={isCsl ? "true" : "false"}
              >
                CSL
              </button>
            </div>
          </div>

          <div className="dictionary-search-wrapper">
            <label className="dictionary-search" htmlFor="signSearch">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m20.4 19-4.7-4.7a7 7 0 1 0-1.4 1.4l4.7 4.7a1 1 0 0 0 1.4-1.4ZM5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z" />
              </svg>
              <input
                id="signSearch"
                name="sign-search"
                type="search"
                placeholder={`Search ${isCsl ? "CSL" : "ASL"} signs`}
                aria-label={`Search ${isCsl ? "CSL" : "ASL"} signs`}
                autoComplete="off"
              />
            </label>
            <p className="dictionary-search-status" id="searchResultsStatus" role="status" aria-live="polite" />
          </div>

          <div className="dictionary-grid" id="dictGrid" />
          <div className="dictionary-empty-state" id="dictionaryEmptyState" hidden>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m20.4 19-4.7-4.7a7 7 0 1 0-1.4 1.4l4.7 4.7a1 1 0 0 0 1.4-1.4ZM5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z" />
            </svg>
            <p>No signs match your search.</p>
          </div>
        </div>
      </main>
    </>
  );
}
