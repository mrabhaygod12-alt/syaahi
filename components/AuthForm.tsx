"use client";
import { useEffect, useRef, useState } from "react";
import { signIn } from "@/lib/auth/session";
import { requestJson } from "@/lib/http-client";
import { workspaceDestination } from "@/lib/workspace-routing";
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
  return (
    <div
      className={compact ? "auth-form compact" : "auth-form wrap"}
      style={
        compact
          ? undefined
          : { paddingTop: 56, paddingBottom: 64, maxWidth: 500 }
      }
    >
      <p className="small">
        {workspace === "writer" ? "YOUR WRITING SPACE" : "YOUR LEARNING SPACE"}
      </p>
      <h1>
        {mode === "signup"
          ? workspace === "writer"
            ? "Your words belong here."
            : "Create your Syaahi account."
          : "Welcome back."}
      </h1>
      <p className="small">
        {workspace === "writer"
          ? mode === "signup"
            ? "Create your writer profile, save private drafts and submit stories for review. Already a student? Use your existing email and password."
            : "Return to your drafts, stories and reading library."
          : mode === "signup"
            ? "Create notes and presentations, practise recall and track your progress. Start with 19 generation credits after email verification."
            : "Return to your lessons, presentations and saved progress."}
      </p>
      <fieldset className="workspace-choice">
        <legend>Where would you like to start?</legend>
        <label>
          <input
            type="radio"
            disabled={busy}
            name="workspace"
            value="student"
            checked={workspace === "student"}
            onChange={() => setWorkspace("student")}
          />
          Learn &amp; create{" "}
          <small>For students, teachers and professionals</small>
        </label>
        <label>
          <input
            type="radio"
            disabled={busy}
            name="workspace"
            value="writer"
            checked={workspace === "writer"}
            onChange={() => setWorkspace("writer")}
          />
          Write &amp; publish{" "}
          <small>Articles, drafts and your creator profile</small>
        </label>
      </fieldset>
      <p className="small">
        {workspace === "writer"
          ? "Already a student? Use the same email and existing password to create a separate writer profile. Your plan and credits stay shared."
          : "Your learning profile stays separate from your writer profile. Writer signup is required before publishing."}
      </p>
      <label className="consent-check">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span>
          I agree to the{" "}
          <a href="/terms" target="_blank" rel="noreferrer">
            Terms of Service
          </a>{" "}
          and acknowledge the{" "}
          <a href="/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          .
        </span>
      </label>
      <button
        disabled={!accepted || busy}
        className="btn light"
        style={{ marginTop: 16, width: "100%" }}
        onClick={async () => {
          if (activeAttempt.current) return;
          const next = workspaceDestination(
            workspace === "writer" && returnTo === "/writer" ? null : returnTo,
            workspace,
          );
          setBusy(true);
          setMsg("");
          setVerifyLink(null);
          try {
            const controller = await prepareSignIn();
            const { response: r, data: d } = await requestJson(
              "/api/auth/google",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  next,
                  workspace,
                  mode,
                  ref: new URLSearchParams(params ?? location.search).get(
                    "ref",
                  ),
                  acceptTerms: accepted,
                  termsVersion: "2026-10-03",
                }),
                signal: controller.signal,
              },
              45000,
            );
            if (!r.ok) throw new Error(d.error);
            if (typeof d.url !== "string" || !d.url.startsWith("https://"))
              throw new Error(
                "Google sign-in could not start. Please try again.",
              );
            location.assign(d.url);
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Google sign-in failed.");
            setBusy(false);
          } finally {
            activeAttempt.current = null;
            setProgress("");
          }
        }}
      >
        Continue with Google
      </button>
      {progress && (
        <p role="status" aria-live="polite">
          {progress}
        </p>
      )}
      <form
        className="card"
        style={{ display: "grid", gap: 16, marginTop: 24 }}
        onSubmit={submit}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -10000,
            width: 1,
            height: 1,
            overflow: "hidden",
          }}
        >
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={10}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <p className="small" style={{ margin: 0 }}>
          Use at least 10 characters. Your notes belong to your account.
        </p>
        <button className="btn dark" disabled={busy || !accepted}>
          {busy
            ? "Please wait..."
            : mode === "signup"
              ? "Create account"
              : "Log in"}
        </button>
        {verifyLink && (
          <div
            style={{
              padding: "16px",
              background: "#ecfdf5",
              border: "1.5px solid #a7f3d0",
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                color: "#065f46",
                fontWeight: 700,
                fontSize: "1rem",
              }}
            >
              ✉️ Email Verification Required
            </p>
            <p
              className="small"
              style={{ margin: "0 0 14px", color: "#047857" }}
            >
              {msg ||
                "Verify your email before signing in or using your study credits."}
            </p>
            <a
              href={verifyLink}
              className="btn dark"
              style={{
                display: "inline-block",
                padding: "8px 20px",
                background: "#059669",
                borderColor: "#059669",
                textDecoration: "none",
              }}
            >
              Click Here to Verify Email →
            </a>
          </div>
        )}
        {msg && !verifyLink && (
          <p role="alert" style={{ color: "#b91c1c" }}>
            {msg}
          </p>
        )}
      </form>
      {mode === "login" && (
        <p className="small">
          <a href="/forgot-password">Forgot your password?</a>
        </p>
      )}
      <p className="small">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <a
              href={`/login?${new URLSearchParams({ workspace, ...(returnTo ? { next: returnTo } : {}) })}`}
              onClick={(e) => {
                if (onModeChange) {
                  e.preventDefault();
                  onModeChange(e.currentTarget.getAttribute("href")!);
                }
              }}
            >
              Log in
            </a>
          </>
        ) : (
          <>
            New here?{" "}
            <a
              href={`/signup?${new URLSearchParams({ workspace, ...(returnTo ? { next: returnTo } : {}) })}`}
              onClick={(e) => {
                if (onModeChange) {
                  e.preventDefault();
                  onModeChange(e.currentTarget.getAttribute("href")!);
                }
              }}
            >
              Create account
            </a>
          </>
        )}
      </p>
      <p className="small">
        By creating an account you agree to our <a href="/terms">Terms</a> and{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>
    </div>
  );
}
