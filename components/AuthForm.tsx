"use client";
import { useEffect, useState } from "react";
import { signIn } from "@/lib/auth/session";
export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [accepted, setAccepted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const error = new URLSearchParams(location.search).get("error");
    if (error) setMsg(error.slice(0, 300));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await signIn(name, email, password, mode, accepted);
      const ref = new URLSearchParams(location.search).get("ref");
      if (mode === "signup" && ref)
        await fetch("/api/referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: ref }),
        });
      const next = new URLSearchParams(location.search).get("next");
      window.location.href =
        next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="wrap"
      style={{ paddingTop: 56, paddingBottom: 64, maxWidth: 500 }}
    >
      <p className="small">YOUR PERSONAL STUDY SPACE</p>
      <h1>
        {mode === "signup" ? "Make room for understanding." : "Welcome back."}
      </h1>
      <p className="small">
        {mode === "signup"
          ? "Create your account. Start with 5 free note sections."
          : "Pick up your notes, questions, and revision where you left off."}
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
          const next =
            new URLSearchParams(location.search).get("next") || "/dashboard";
          setBusy(true);
          try {
            const r = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                next,
                acceptTerms: accepted,
                termsVersion: "2026-09-24",
              }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            location.assign(d.url);
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Google sign-in failed.");
            setBusy(false);
          }
        }}
      >
        Continue with Google
      </button>
      <form
        className="card"
        style={{ display: "grid", gap: 16, marginTop: 24 }}
        onSubmit={submit}
      >
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
        {msg && (
          <p role="alert" style={{ color: "#b91c1c" }}>
            {msg}
          </p>
        )}
      </form>
      <p className="small">
        {mode === "signup" ? (
          <>
            Already have an account? <a href="/login">Log in</a>
          </>
        ) : (
          <>
            New here? <a href="/signup">Create account</a>
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
