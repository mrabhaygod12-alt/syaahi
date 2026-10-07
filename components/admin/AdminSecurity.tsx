"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import SessionSecurity from "@/components/SessionSecurity";
export default function AdminSecurity() {
  const [status, setStatus] = useState<any>(null),
    [setup, setSetup] = useState<any>(null),
    [codes, setCodes] = useState<string[]>([]),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = async () => {
    const r = await requestJson("/api/admin/mfa");
    if (!r.response.ok) throw new Error(r.data.error);
    setStatus(r.data);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      const r = await requestJson("/api/admin/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "begin" ? { password } : { code, id: setup?.id }),
        }),
      });
      if (!r.response.ok) throw new Error(r.data.error);
      setPassword("");
      setCode("");
      if (action === "begin") setSetup(r.data);
      else {
        setSetup(null);
        setCodes(r.data.recoveryCodes || []);
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="wrap feature-section admin-content">
      <p className="eyebrow">PRIVILEGED ACCESS</p>
      <h1>Your administrator security.</h1>
      <p>
        Verify a second factor before managing people, editorial decisions or
        payments. Verification lasts 15 minutes in this session.
      </p>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {!status ? (
        <p role="status">Loading security settings…</p>
      ) : (
        <section className="admin-panel">
          {status.verified ? (
            <>
              <p className="admin-status">
                Administrator verification active until{" "}
                {new Date(status.verifiedUntil).toLocaleTimeString()}.
              </p>
              {codes.length > 0 && (
                <div className="admin-recovery">
                  <h2>Save your recovery codes now.</h2>
                  <p>
                    Each code works once. Store them in your password manager;
                    they cannot be displayed again.
                  </p>
                  <textarea
                    aria-label="Recovery codes"
                    readOnly
                    rows={8}
                    value={codes.join("\n")}
                  />
                  <button
                    className="btn light"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(codes.join("\n"))
                        .catch(() =>
                          setError("Select the codes and copy them manually."),
                        )
                    }
                  >
                    Copy recovery codes
                  </button>
                </div>
              )}
              <a className="btn dark" href="/admin">
                Open control room
              </a>
            </>
          ) : !status.configured ? (
            <p role="alert">
              MFA encryption needs a backend configuration update. Set
              ADMIN_MFA_KEY to 32 random bytes encoded as base64, or retain the
              existing secure backend proxy key. Contact the service owner.
            </p>
          ) : setup ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act("confirm");
              }}
            >
              <h2>Connect your authenticator.</h2>
              <img
                src={setup.qr}
                alt="Authenticator enrollment QR code"
                width={240}
                height={240}
              />
              <details>
                <summary>Enter a setup key manually</summary>
                <code>{setup.secret}</code>
              </details>
              <label>
                Six-digit authenticator code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                />
              </label>
              <button className="btn dark" disabled={busy}>
                Confirm authenticator
              </button>
            </form>
          ) : status.enrolled ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act("verify");
              }}
            >
              <h2>Verify this session.</h2>
              <label>
                Authenticator or recovery code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  maxLength={64}
                  required
                />
              </label>
              <p>
                {status.recoveryRemaining} recovery codes remain. A reused code
                is rejected.
              </p>
              <button className="btn dark" disabled={busy}>
                Verify administrator access
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act("begin");
              }}
            >
              <h2>Enroll an authenticator.</h2>
              <p>
                Confirm your password. Google accounts can sign in again with
                Google and return here within five minutes.
              </p>
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={1024}
                />
              </label>
              <button className="btn dark" disabled={busy}>
                Set up authenticator
              </button>
              <a
                className="admin-inline-link"
                href="/login?next=/admin/security"
              >
                Sign in again
              </a>
            </form>
          )}
        </section>
      )}
      <SessionSecurity />
    </main>
  );
}
