"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import "./session-security.css";
export default function SessionSecurity() {
  const [sessions, setSessions] = useState<any[]>([]),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = async () => {
    const r = await requestJson("/api/user/sessions");
    if (!r.response.ok) throw new Error(r.data.error);
    setSessions(r.data.sessions);
    setLoaded(true);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function revoke(action: "revoke" | "others", id?: string) {
    setBusy(true);
    setError("");
    try {
      const r = await requestJson("/api/user/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      if (!r.response.ok) throw new Error(r.data.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke session.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="session-security card">
      <h2>Where you’re signed in.</h2>
      <p>Signing out another device immediately removes its account access.</p>
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            className="btn light"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError("");
              load()
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            Reload sessions
          </button>
        </>
      )}
      {!loaded ? (
        <p role="status">Loading active sessions…</p>
      ) : (
        <>
          <button
            className="btn light"
            onClick={() => revoke("others")}
            disabled={busy || sessions.length < 2}
          >
            Sign out other devices
          </button>
          <ul>
            {sessions.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>
                    {s.current ? "This device" : "Signed-in device"}
                  </strong>
                  <p className="small">{s.device}</p>
                  <span className="small">
                    {s.method === "oauth" ? "Google" : "Email"} · expires{" "}
                    {new Date(s.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                {!s.current && (
                  <button
                    className="btn light"
                    disabled={busy}
                    onClick={() => revoke("revoke", s.id)}
                  >
                    Sign out device
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
