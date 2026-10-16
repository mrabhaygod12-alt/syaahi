"use client";

import { useEffect, useState, useRef } from "react";
import AuthShell from "@/components/AuthShell";
import { workspaceDestination } from "@/lib/workspace-routing";
import { refreshUser } from "@/lib/auth/session";

export default function VerifyEmail() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const initialVerification = useRef(false);

  useEffect(() => {
    const hashToken = location.hash.replace(/^#/, "").trim();
    const queryToken = new URLSearchParams(location.search)
      .get("token")
      ?.trim();
    const foundToken = hashToken || queryToken || "";
    if (foundToken && !initialVerification.current) {
      initialVerification.current = true;
      setToken(foundToken);
      history.replaceState(null, "", location.pathname);
      // Auto confirm if token is in URL
      void confirmWithToken(foundToken);
    }
  }, []);

  async function confirmWithToken(t: string) {
    if (!t || busy) return;
    setBusy(true);
    setMessage("Verifying your email token...");
    try {
      const r = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Verification failed.");
      setIsSuccess(true);
      setMessage(
        "Email verified successfully! Your account and 19 welcome credits are now active.",
      );
      const verifiedUser = await refreshUser().catch(() => null);
      setTimeout(() => {
        window.location.href = workspaceDestination(
          null,
          verifiedUser?.workspace || "student",
        );
      }, 1500);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Verification link is invalid or expired.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <section className="auth-redesign">
        <p className="eyebrow">ACCOUNT ACTIVATION</p>
        <h1>Verify your email</h1>
        <p className="small">
          Verify your email address to unlock AI notes generation, custom PDF
          downloads, and your 19 welcome credits.
        </p>

        {message && (
          <div
            role="status"
            style={{
              padding: "16px 20px",
              borderRadius: 10,
              margin: "20px 0",
              fontWeight: 600,
              background: isSuccess ? "#ecfdf5" : "#fef2f2",
              color: isSuccess ? "#065f46" : "#991b1b",
              border: `1.5px solid ${isSuccess ? "#a7f3d0" : "#fecaca"}`,
            }}
          >
            {isSuccess ? "🎉 " : "⚠️ "}
            {message}
          </div>
        )}

        {isSuccess ? (
          <div style={{ marginTop: 24 }}>
            <a
              href="/dashboard"
              className="btn dark"
              style={{ padding: "12px 28px", fontSize: "1rem" }}
            >
              Go to Dashboard →
            </a>
          </div>
        ) : (
          <div
            className="card"
            style={{ marginTop: 20, display: "grid", gap: 16 }}
          >
            <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
              Verification Code / Token
              <input
                type="text"
                placeholder="Paste your 64-character verification code"
                value={token}
                onChange={(e) => setToken(e.target.value.trim())}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                }}
              />
            </label>
            <button
              className="btn dark"
              disabled={busy || !token}
              onClick={() => confirmWithToken(token)}
              style={{ padding: "10px 20px" }}
            >
              {busy ? "Verifying..." : "Confirm & Activate Account"}
            </button>
          </div>
        )}

        <p className="small" style={{ marginTop: 30, color: "#6b7280" }}>
          Already verified? <a href="/login">Sign in</a> · Need help?{" "}
          <a href="/support">Contact support</a>
        </p>
      </section>
    </AuthShell>
  );
}
