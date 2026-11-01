"use client";

import { useEffect, useRef, useState } from "react";

export default function HeaderClient({ activePage, user }) {
  const [learnOpen, setLearnOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const learnMenu = useRef(null);

  useEffect(() => {
    if (localStorage.getItem("darkMode") === "true") {
      document.body.classList.add("dark-mode");
    }

    function closeMenu(event) {
      if (!learnMenu.current?.contains(event.target)) setLearnOpen(false);
    }

    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, []);

  function toggleTheme() {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", String(document.body.classList.contains("dark-mode")));
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.assign("/");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <header className="dex-header">
      <a className="dex-logo dex-logo-link" href="/" aria-label="Dexter home">
        <img src="/logo.png" alt="" width="48" height="48" />
        <span className="dex-blue">Dexter</span>
      </a>
      <nav className="dex-nav" aria-label="Primary navigation">
        <a href="/" className={`dex-nav-item${activePage === "home" ? " active" : ""}`}>
          Home
        </a>
        <a
          href="/translate"
          className={`dex-nav-item${activePage === "translate" ? " active" : ""}`}
        >
          Translate
        </a>
        <div ref={learnMenu} className={`dex-nav-dropdown${learnOpen ? " show" : ""}`}>
          <button
            className={`dex-nav-item dex-nav-dropdown-trigger${activePage === "learn" ? " active" : ""}`}
            type="button"
            aria-haspopup="true"
            aria-expanded={learnOpen}
            onClick={() => setLearnOpen((open) => !open)}
          >
            <span>Learn</span>
            <svg className="dex-nav-chevron" aria-hidden="true" viewBox="0 0 20 20">
              <path d="m5.5 7.5 4.5 4.5 4.5-4.5" />
            </svg>
          </button>
          <div className="dex-nav-dropdown-content">
            <a href="/learn?lang=asl" className="dex-nav-dropdown-item">
              ASL dictionary
            </a>
            <a href="/learn?lang=csl" className="dex-nav-dropdown-item">
              CSL dictionary
            </a>
          </div>
        </div>
      </nav>

      <div className="dex-header-actions">
        {user ? (
          <>
            <a className="dex-account-link" href="/account" title={user.email}>
              <span className="dex-avatar" aria-hidden="true">
                {user.name?.slice(0, 1).toUpperCase() || "D"}
              </span>
              <span className="dex-account-name">{user.name}</span>
            </a>
            <button className="dex-header-text-btn" type="button" onClick={logout} disabled={loggingOut}>
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </>
        ) : (
          <>
            <a className="dex-header-text-btn" href="/login">
              Log in
            </a>
            <a className="dex-header-cta" href="/signup">
              Create account
            </a>
          </>
        )}
        <button
          id="darkModeToggle"
          className="theme-toggle-btn"
          type="button"
          title="Toggle dark mode"
          aria-label="Toggle dark mode"
          onClick={toggleTheme}
        >
          <svg focusable="false" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
