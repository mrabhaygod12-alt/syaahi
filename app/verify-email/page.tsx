"use client";
import { useEffect, useState } from "react";
export default function VerifyEmail() {
  const [token, setToken] = useState(""),
    [message, setMessage] = useState(
      "Sign in to the account that received this email, then confirm.",
    ),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setToken(location.hash.slice(1));
    history.replaceState(null, "", location.pathname);
  }, []);
  return (
    <main className="wrap" style={{ maxWidth: 620, padding: "70px 24px" }}>
      <h1>Verify your email</h1>
      <p role="status">{message}</p>
      <button
        className="btn dark"
        disabled={busy || !token}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/auth/verify-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setMessage(
              "Email verified. Eligible referral rewards have been recorded.",
            );
            setToken("");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Please retry.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Confirm email
      </button>
      <p>
        <a href="/login" target="_blank" rel="noreferrer">
          Sign in in another tab
        </a>{" "}
        · <a href="/refer">Referral wallet</a>
      </p>
    </main>
  );
}
