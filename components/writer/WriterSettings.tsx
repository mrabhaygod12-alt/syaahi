"use client";
import { useState } from "react";
import WriterShell, { useWriter } from "./WriterShell";
import { ProfileEditor } from "./WriterProfileView";
import { requestJson } from "@/lib/http-client";
import WorkspaceSwitch from "../WorkspaceSwitch";
function SettingsContent() {
  const { profile, update } = useWriter();
  const [edit, setEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="writer-settings writer-primary">
      <p className="writer-kicker">MAKE YOURSELF AT HOME</p>
      <h1>Settings</h1>
      <div className="writer-setting-row">
        <div>
          <h3>Profile information</h3>
          <p>Your writer photo, name, pronouns, bio and About page.</p>
        </div>
        <button className="writer-text-button" onClick={() => setEdit(true)}>
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
          disabled={busy}
          onChange={async (e) => {
            setBusy(true);
            setError("");
            try {
              const { response, data } = await requestJson(
                "/api/writer/profile",
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    appearance: e.target.value,
                    expectedUpdatedAt: profile.updatedAt,
                  }),
                },
              );
              if (!response.ok) throw new Error(data.error);
              update(data.profile);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not update appearance.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <option value="system">Use device setting</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div className="writer-setting-row">
        <div>
          <h3>Membership & billing</h3>
          <p>
            Your plan and generation credits cover both student and writer
            workspaces.
          </p>
        </div>
        <a href="/account/billing">Manage membership ↗</a>
      </div>
      <div className="writer-setting-row">
        <div>
          <h3>Learning workspace</h3>
          <p>Return to your lessons and your separate student profile.</p>
        </div>
        <WorkspaceSwitch current="writer" />
      </div>
      <div className="writer-setting-row">
        <div>
          <h3>Account security</h3>
          <p>Manage your account identity and verification.</p>
        </div>
        <a href="/profile">Open account settings ↗</a>
      </div>
      <div className="writer-setting-row">
        <div>
          <h3>Help with writing</h3>
          <p>Get support with drafts, publishing and your account.</p>
        </div>
        <a href="/support">Contact support ↗</a>
      </div>
      {error && <p role="alert">{error}</p>}
      {edit && <ProfileEditor onClose={() => setEdit(false)} />}
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
