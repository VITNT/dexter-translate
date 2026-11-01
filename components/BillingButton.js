"use client";

import { useState } from "react";

export default function BillingButton({ plan, signedIn, mode = "checkout", children, className = "" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function begin() {
    if (!signedIn) {
      window.location.assign(`/signup?next=${encodeURIComponent("/account")}`);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/billing/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan ? { plan } : {})
      });
      const result = await response.json();
      if (!response.ok || !result.url) {
        setError(result.error || "Billing is temporarily unavailable.");
        setBusy(false);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("Could not connect to billing. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="billing-action-wrap">
      <button className={className} type="button" onClick={begin} disabled={busy}>
        {busy ? "Opening secure checkout…" : children}
      </button>
      {error && <div className="billing-inline-error" role="alert">{error}</div>}
    </div>
  );
}
