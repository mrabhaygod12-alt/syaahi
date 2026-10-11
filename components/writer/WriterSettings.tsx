"use client";
import { useEffect, useRef, useState } from "react";
import WriterShell, { useWriter } from "./WriterShell";
import { ProfileEditor } from "./WriterProfileView";
import { requestJson, ServiceRequestError } from "@/lib/http-client";
import { useAccount } from "../WorkspaceProvider";
import SessionSecurity from "../SessionSecurity";
import ReadingPreferences from "./ReadingPreferences";
import "./preferences.css";
function SettingsContent() {
  const { profile, update } = useWriter();
  const { user } = useAccount();
  const [edit, setEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const changeAppearance = async (appearance?: string) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      const { response, data } = await requestJson(
        "/api/writer/profile",
        appearance === undefined
          ? { signal: controller.signal }
          : {
              method: "PATCH",
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                appearance,
                expectedUpdatedAt: profile.updatedAt,
              }),
            },
      );
      if (controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status === 409) setConflict(true);
        throw new ServiceRequestError(
          data.error || "Could not update appearance.",
          response.status,
          data.requestId,
        );
      }
      update(data.profile);
      setConflict(false);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted && pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  };
  return (
    <section className="writer-settings writer-primary">
      <p className="writer-kicker">MAKE YOURSELF AT HOME</p>
      <h1>Settings</h1>
      <div className="writer-setting-row">
        <div>
          <h3>Profile information</h3>
          <p>Your writer photo, name, pronouns, bio and About page.</p>
        </div>
        <button
          className="writer-text-button"
          disabled={busy}
          onClick={() => setEdit(true)}
        >
          Edit profile
        </button>
      </div>
      <div className="writer-setting-row">
        <div>
          <h3>Appearance</h3>
          <p>Choose the reading and writing environment that suits you.</p>
        </div>
        <select
          aria-label="Writer appearance"
          value={profile.appearance}
          disabled={busy || conflict}
          onChange={(e) => void changeAppearance(e.target.value)}
        >
          <option value="system">Use device setting</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      {error && (
        <div className="writer-profile-conflict">
          <p role="alert">{error}</p>
          <button
            className="btn light"
            disabled={busy}
            onClick={() => void changeAppearance()}
          >
            Reload saved profile
          </button>
        </div>
      )}
      <div className="writer-setting-row">
        <div>
          <h3>Membership & billing</h3>
          <p>
            Your plan and generation credits cover both student and writer
            workspaces.
          </p>
        </div>
        <a href="/writer/billing">Manage membership ↗</a>
      </div>
      <div className="writer-setting-row">
        <div>
          <h3>Account identity</h3>
          <p>
            {user?.email} ·{" "}
            {user?.verified ? "Verified email" : "Email account"}
          </p>
        </div>
        <span className="writer-topic">Writer session</span>
      </div>
      <div className="writer-setting-row">
        <div>
          <h3>Account security</h3>
          <p>Manage your account identity and verification.</p>
        </div>
        <a href="/writer/support">Get account help ↗</a>
      </div>
      <div className="writer-setting-row">
        <div>
          <h3>Help with writing</h3>
          <p>Get support with drafts, publishing and your account.</p>
        </div>
        <a href="/writer/support">Contact support ↗</a>
      </div>
      <ReadingPreferences />
      <SessionSecurity />
      {edit && (
        <ProfileEditor key={profile.owner} onClose={() => setEdit(false)} />
      )}
    </section>
  );
}
export default function WriterSettings() {
  return (
    <WriterShell>
      <SettingsContent />
    </WriterShell>
  );
}
