"use client";

import { useState } from "react";

export default function AuthForm({ mode, nextPath }) {
  const isSignup = mode === "signup";
  const [error, setError] = useState("");
  const [field, setField] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setField("");
    setSubmitting(true);

    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (isSignup && data.password !== data.confirmPassword) {
      setError("Passwords do not match.");
      setField("confirmPassword");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, next: nextPath })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Something went wrong. Please try again.");
        setField(result.field || "");
        setSubmitting(false);
        return;
      }
      window.location.assign(result.redirectTo || "/translate");
    } catch {
      setError("Dexter could not connect. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {isSignup && (
        <label className="auth-field">
          <span>Name</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            minLength="2"
            maxLength="60"
            aria-invalid={field === "name"}
            required
          />
        </label>
      )}
      <label className="auth-field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength="254"
          aria-invalid={field === "email"}
          required
        />
      </label>
      <label className="auth-field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength="8"
          maxLength="128"
          aria-invalid={field === "password"}
          required
        />
        {isSignup && <small>Use at least 8 characters, including a letter and a number.</small>}
      </label>
      {isSignup && (
        <label className="auth-field">
          <span>Confirm password</span>
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength="8"
            maxLength="128"
            aria-invalid={field === "confirmPassword"}
            required
          />
        </label>
      )}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="auth-submit" type="submit" disabled={submitting}>
        {submitting ? "Please wait…" : isSignup ? "Create my account" : "Log in"}
      </button>
    </form>
  );
}
