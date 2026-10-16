"use client";
import { useEffect, useRef, useState } from "react";
import { signIn } from "@/lib/auth/session";
import { requestJson } from "@/lib/http-client";
import { workspaceDestination } from "@/lib/workspace-routing";
import AuthShell from "./AuthShell";

import "./growth/growth.css";
export default function AuthForm({
  mode,
  compact = false,
  params,
  onModeChange,
}: {
  mode: "login" | "signup";
  compact?: boolean;
  params?: string;
  onModeChange?: (href: string) => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [workspace, setWorkspace] = useState<"student" | "writer">(
    params && new URLSearchParams(params).get("workspace") === "writer"
      ? "writer"
      : "student",
  );
  const [returnTo, setReturnTo] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const activeAttempt = useRef<AbortController | null>(null);
  const [verifyLink, setVerifyLink] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(params ?? location.search);
    const error = query.get("error");
    if (error) setMsg(error.slice(0, 300));
    const next = query.get("next");
    if (
      next?.startsWith("/") &&
      !next.startsWith("//") &&
      !/[\\\u0000-\u001f]/.test(next)
    )
      setReturnTo(next);
    if (
      query.get("workspace") === "writer" ||
      (!query.has("workspace") && /^\/(writer|write)(\/|\?|$)/.test(next || ""))
    )
      setWorkspace("writer");
    return () => activeAttempt.current?.abort();
  }, []);

  async function prepareSignIn() {
    activeAttempt.current?.abort();
    const controller = new AbortController();
    activeAttempt.current = controller;
    setProgress(
      mode === "signup" ? "Creating your account…" : "Signing you in…",
    );
    return controller;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (activeAttempt.current) return;
    setBusy(true);
    setMsg("");
    setVerifyLink(null);
    try {
      const controller = await prepareSignIn();
      const ref = new URLSearchParams(params ?? location.search).get("ref");
      const res = await signIn(
        name,
        email,
        password,
        mode,
        accepted,
        mode === "signup" ? ref : null,
        workspace,
        controller.signal,
        website,
        undefined,
      );
      if (res.requireVerification) {
        setVerifyLink(res.verifyUrl || "/verify-email");
        setMsg(
          res.message ||
            "Account created! Please verify your email before signing in.",
        );
        return;
      }
      window.location.href = workspaceDestination(
        workspace === "writer" && returnTo === "/writer" ? null : returnTo,
        workspace,
      );
    } catch (error: any) {
      if (error?.requireVerification && error?.verifyUrl) {
        setVerifyLink(error.verifyUrl);
      }
      setMsg(error instanceof Error ? error.message : "Please retry.");
    } finally {
      activeAttempt.current = null;
      setProgress("");
      setBusy(false);
    }
  }

  async function google() {
    if (activeAttempt.current || !accepted) return;
    setBusy(true);
    setMsg("");
    setVerifyLink(null);
    try {
      const controller = await prepareSignIn();
      const next = workspaceDestination(
        workspace === "writer" && returnTo === "/writer" ? null : returnTo,
        workspace,
      );
      const { response, data } = await requestJson(
        "/api/auth/google",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            next,
            workspace,
            mode,
            ref: new URLSearchParams(params ?? location.search).get("ref"),
            acceptTerms: accepted,
            termsVersion: "2026-10-03",
          }),
          signal: controller.signal,
        },
        45000,
      );
      if (!response.ok)
        throw new Error(data.error || "Google sign-in could not start.");
      if (typeof data.url !== "string" || !data.url.startsWith("https://"))
        throw new Error("Google sign-in could not start.");
      location.assign(data.url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Google sign-in failed.");
      setBusy(false);
    } finally {
      activeAttempt.current = null;
      setProgress("");
    }
  }
  const content = (
    <div
      className={
        compact ? "auth-form compact auth-redesign" : "auth-form auth-redesign"
      }
    >
      <p className="eyebrow">
        {workspace === "writer" ? "YOUR WRITING SPACE" : "YOUR STUDY SPACE"}
      </p>
      <h1>
        {mode === "login"
          ? "Good to see you again."
          : workspace === "writer"
            ? "Your next story starts here."
            : "Your ideas, a little clearer."}
      </h1>
      <p className="auth-description">
        {mode === "login"
          ? "Sign in to pick up where you left off."
          : workspace === "writer"
            ? "Private drafts, your own profile and reviewed publishing."
            : "Create an account. Choose your course after verification."}
      </p>
      <fieldset className="workspace-choice auth-workspace">
        <legend>Choose your workspace</legend>
        {(
          [
            ["student", "Learn & create"],
            ["writer", "Write & publish"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="radio"
              name="workspace"
              disabled={busy}
              value={key}
              checked={workspace === key}
              onChange={() => setWorkspace(key)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <form onSubmit={submit} className="auth-fields">
        <div className="auth-honeypot" aria-hidden="true">
          <label>
            Leave this field empty
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>
        {mode === "signup" && (
          <label>
            Full name
            <input
              type="text"
              autoComplete="name"
              maxLength={80}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Password
          <span className="auth-password">
            <input
              aria-label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              minLength={10}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        <div className="auth-field-help">
          {mode === "login" ? (
            <a href="/forgot-password">Forgot your password?</a>
          ) : (
            <span>Use at least 10 characters.</span>
          )}
        </div>
        <label className="consent-check">
          <input
            type="checkbox"
            checked={accepted}
            disabled={busy}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            I agree to the{" "}
            <a href="/terms" target="_blank" rel="noreferrer">
              Terms
            </a>{" "}
            and acknowledge the{" "}
            <a href="/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </a>
            .
          </span>
        </label>
        <button className="btn dark" disabled={busy || !accepted}>
          {busy
            ? progress || "Please wait…"
            : mode === "signup"
              ? "Create account"
              : "Log in"}
        </button>
      </form>
      <div className="auth-divider">
        <span>or</span>
      </div>
      <button
        type="button"
        className="btn light auth-google"
        disabled={busy || !accepted}
        onClick={() => void google()}
      >
        Continue with Google
      </button>
      {!accepted && (
        <p className="auth-consent-help">
          Accept the terms above to continue with either option.
        </p>
      )}
      {progress && (
        <p role="status" aria-live="polite">
          {progress}
        </p>
      )}
      {verifyLink ? (
        <div className="auth-success" role="status">
          <strong>Check your email</strong>
          <p>{msg || "Verify your email to finish setting up your account."}</p>
          <a className="btn light" href={verifyLink}>
            Open verification
          </a>
        </div>
      ) : (
        msg && (
          <p role="alert" className="auth-error">
            {msg}
          </p>
        )
      )}
      <p className="auth-switch">
        {mode === "signup" ? "Already have an account? " : "New to Syaahii? "}
        <a
          href={`${mode === "signup" ? "/login" : "/signup"}?${new URLSearchParams({ workspace, ...(returnTo ? { next: returnTo } : {}) })}`}
          onClick={(e) => {
            if (onModeChange) {
              e.preventDefault();
              onModeChange(e.currentTarget.getAttribute("href")!);
            }
          }}
        >
          {mode === "signup" ? "Log in" : "Create account"}
        </a>
      </p>
      {workspace === "writer" && (
        <p className="auth-consent-help">
          Already a student? Use your existing email and password to enrol as a
          writer.
        </p>
      )}
    </div>
  );
  return compact ? content : <AuthShell>{content}</AuthShell>;
}
