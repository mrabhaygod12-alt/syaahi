"use client";
import { useEffect, useRef, useState } from "react";
import { requestJson, ServiceRequestError } from "@/lib/http-client";
import SessionSecurity from "@/components/SessionSecurity";

interface Status {
  configured: boolean;
  enrolled: boolean;
  verified: boolean;
  verifiedUntil: number | null;
  recoveryRemaining: number;
}
interface Setup {
  id: string;
  qr: string;
  secret: string;
  replacing?: boolean;
}
type Action =
  | "begin"
  | "confirm"
  | "verify"
  | "replace"
  | "rotate-recovery"
  | "cancel-replacement";
export default function AdminSecurity() {
  const [status, setStatus] = useState<Status | null>(null),
    [setup, setSetup] = useState<Setup | null>(null),
    [codes, setCodes] = useState<string[]>([]),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [maintenance, setMaintenance] = useState<
      "replace" | "rotate-recovery" | null
    >(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const load = async (controller: AbortController) => {
    const r = await requestJson<
      Status & { error?: string; requestId?: string }
    >("/api/admin/mfa", { signal: controller.signal });
    if (!r.response.ok)
      throw new ServiceRequestError(
        r.data.error || "Security settings could not be loaded.",
        r.response.status,
        r.data.requestId,
      );
    if (!controller.signal.aborted && request.current === controller)
      setStatus(r.data);
  };
  async function reload() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      await load(controller);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Security settings could not be loaded.",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    void reload();
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, []);
  async function act(action: Action) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const r = await requestJson("/api/admin/mfa", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, password, code, id: setup?.id }),
      });
      if (!r.response.ok)
        throw new ServiceRequestError(
          r.data.error || "Verification failed.",
          r.response.status,
          r.data.requestId,
        );
      if (controller.signal.aborted || request.current !== controller) return;
      setPassword("");
      setCode("");
      setMaintenance(null);
      if (action === "begin" || action === "replace") setSetup(r.data as Setup);
      else {
        setSetup(null);
        setCodes(r.data.recoveryCodes || []);
        await load(controller);
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  function choose(action: typeof maintenance) {
    setCodes([]);
    setMaintenance(action);
    setPassword("");
    setCode("");
    setError("");
  }
  const identityFields = (
    <>
      <p>
        Confirm your current password, or sign in with Google again and return
        within five minutes.
      </p>
      <label>
        Current password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={1024}
          disabled={busy}
        />
      </label>
      <a className="admin-inline-link" href="/login?next=/admin/security">
        Sign in again
      </a>
    </>
  );
  return (
    <main className="wrap feature-section admin-content">
      <p className="eyebrow">PRIVILEGED ACCESS</p>
      <h1>Your administrator security.</h1>
      <p>
        Verify a second factor before managing people, editorial decisions or
        payments. Verification lasts 15 minutes in this session.
      </p>
      {error && (
        <div className="admin-error" role="alert">
          <p>{error}</p>
          <button
            className="btn light"
            disabled={busy}
            onClick={() => void reload()}
          >
            Reload security status
          </button>
        </div>
      )}
      {!status && !error ? (
        <p role="status">Loading security settings…</p>
      ) : (
        status && (
          <section className="admin-panel admin-factor-panel" aria-busy={busy}>
            {status.verified && (
              <p className="admin-status">
                Administrator verification active until{" "}
                {new Date(status.verifiedUntil!).toLocaleTimeString()}.
              </p>
            )}
            {codes.length > 0 && (
              <div className="admin-recovery">
                <h2>Save your recovery codes now.</h2>
                <p>
                  Each code works once. These codes replace every previous
                  recovery code. Store them in your password manager; they
                  cannot be displayed again.
                </p>
                <textarea
                  aria-label="Recovery codes"
                  readOnly
                  rows={8}
                  value={codes.join("\n")}
                  spellCheck={false}
                />
                <div className="admin-factor-actions">
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
                  <button className="btn light" onClick={() => setCodes([])}>
                    Hide saved codes
                  </button>
                </div>
              </div>
            )}
            {!status.configured ? (
              <p role="alert">
                MFA encryption needs a backend configuration update. Contact the
                service owner.
              </p>
            ) : setup ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("confirm");
                }}
              >
                <h2>
                  {setup.replacing
                    ? "Connect your replacement authenticator."
                    : "Connect your authenticator."}
                </h2>
                {setup.replacing && (
                  <p>
                    Your current authenticator stays active until the new one is
                    confirmed. Confirmation invalidates old codes and other
                    administrator verifications.
                  </p>
                )}
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
                    maxLength={6}
                    required
                    disabled={busy}
                  />
                </label>
                <button className="btn dark" disabled={busy}>
                  Confirm authenticator
                </button>
                {setup.replacing && (
                  <button
                    className="btn light"
                    type="button"
                    disabled={busy}
                    onClick={() => void act("cancel-replacement")}
                  >
                    Keep current authenticator
                  </button>
                )}
              </form>
            ) : !status.enrolled ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("begin");
                }}
              >
                <h2>Enroll an authenticator.</h2>
                {identityFields}
                <button className="btn dark" disabled={busy}>
                  Set up authenticator
                </button>
              </form>
            ) : (
              <>
                {!status.verified && (
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
                        disabled={busy || !!maintenance}
                      />
                    </label>
                    <p>
                      {status.recoveryRemaining} recovery codes remain. A reused
                      code is rejected.
                    </p>
                    <button
                      className="btn dark"
                      disabled={busy || !!maintenance}
                    >
                      Verify administrator access
                    </button>
                  </form>
                )}
                <div className="admin-factor-maintenance">
                  <p className="eyebrow">ACCOUNT RECOVERY</p>
                  <h2>Keep your access recoverable.</h2>
                  <p>
                    {status.recoveryRemaining} unused recovery codes remain.
                    Changes require a fresh code even when administrator
                    verification is active.
                  </p>
                  {maintenance ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void act(maintenance);
                      }}
                    >
                      <h3>
                        {maintenance === "replace"
                          ? "Replace your authenticator"
                          : "Generate new recovery codes"}
                      </h3>
                      <p>
                        {maintenance === "replace"
                          ? "Verify your current factor, then connect the replacement. Your existing authenticator keeps working during setup."
                          : "This replaces all previous recovery codes and expires administrator verification in other sessions. Save the new codes before leaving this page."}
                      </p>
                      {identityFields}
                      <label>
                        Current authenticator or unused recovery code
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          autoComplete="one-time-code"
                          maxLength={64}
                          required
                          disabled={busy}
                        />
                      </label>
                      <div className="admin-factor-actions">
                        <button className="btn dark" disabled={busy}>
                          {maintenance === "replace"
                            ? "Start replacement setup"
                            : "Replace recovery codes"}
                        </button>
                        <button
                          type="button"
                          className="btn light"
                          disabled={busy}
                          onClick={() => choose(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="admin-factor-actions">
                      <button
                        className="btn light"
                        disabled={busy}
                        onClick={() => choose("rotate-recovery")}
                      >
                        Generate new recovery codes
                      </button>
                      <button
                        className="btn light"
                        disabled={busy}
                        onClick={() => choose("replace")}
                      >
                        Replace authenticator
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            {status.verified && (
              <a className="btn dark" href="/admin">
                Open control room
              </a>
            )}
          </section>
        )
      )}
      <SessionSecurity />
    </main>
  );
}
