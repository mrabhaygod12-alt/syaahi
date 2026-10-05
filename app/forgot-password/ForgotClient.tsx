"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import "@/components/student-dashboard.css";
export default function ForgotClient() {
  const [email, setEmail] = useState(""),
    [token, setToken] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false);
  useEffect(() => {
    if (/^[a-f0-9]{64}$/.test(location.hash.slice(1))) {
      setToken(location.hash.slice(1));
      history.replaceState(null, "", location.pathname + location.search);
    }
  }, []);
  return (
    <section
      className="wrap feature-section"
      style={{ maxWidth: 560, width: "100%" }}
    >
      <h1>{token ? "Choose a new password" : "Recover your account"}</h1>
      <p>
        {token
          ? "This link expires after 30 minutes and can be used once. Resetting signs out your existing sessions."
          : "Enter the email used for your student or writer account. The same account password works across both workspaces."}
      </p>
      {message && (
        <p role="status" className="card">
          {message}
        </p>
      )}
      {!done && (
        <form
          className="hub-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (token && password !== confirm) {
              setMessage("The passwords do not match.");
              return;
            }
            setBusy(true);
            try {
              const { response, data } = await requestJson(
                "/api/auth/recovery",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(
                    token ? { action: "reset", token, password } : { email },
                  ),
                },
              );
              if (!response.ok) throw new Error(data.error);
              setMessage(
                token
                  ? "Password changed. Sign in again with your new password."
                  : data.message,
              );
              setDone(true);
              if (token) {
                for (const key of Object.keys(localStorage))
                  if (
                    /^syaahi-(composer|offline|review-queue|deck-draft|deck-selection):/.test(
                      key,
                    )
                  )
                    localStorage.removeItem(key);
                window.dispatchEvent(new Event("syaahi:account-updated"));
              }
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Please retry.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {token ? (
            <>
              <label>
                New password
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label>
                Confirm new password
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
            </>
          ) : (
            <label>
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          <button className="btn dark" disabled={busy}>
            {busy ? "Working…" : token ? "Reset password" : "Send reset link"}
          </button>
        </form>
      )}
      <p>
        <a href="/login">Back to log in</a> ·{" "}
        <a href="/support">Contact support</a>
      </p>
    </section>
  );
}
