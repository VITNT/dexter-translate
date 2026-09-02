"use client";

import { useState } from "react";

export default function AccountActions() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.assign("/");
    } catch {
      setBusy(false);
    }
  }

  return (
    <button className="account-signout" type="button" onClick={logout} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
