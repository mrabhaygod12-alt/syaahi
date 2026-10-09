"use client";
import { useEffect, useState } from "react";
import WriterShell, { useWriter, WriterAvatar } from "./WriterShell";
import Modal from "../Modal";
import { StoryRow } from "../WriterDashboard";
import { requestJson } from "@/lib/http-client";
import type { Story } from "@/lib/writing/stories";
import ConnectionsPanel from "./ConnectionsPanel";
import "./social-workspace.css";
export function ProfileEditor({ onClose }: { onClose: () => void }) {
  const { profile, update } = useWriter();
  const [form, setForm] = useState(profile),
    [pronouns, setPronouns] = useState(profile.pronouns.join(", ")),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const changed =
    JSON.stringify(form) !== JSON.stringify(profile) ||
    pronouns !== profile.pronouns.join(", ");
  const close = () => {
    if (
      !busy &&
      (!changed || window.confirm("Discard your unsaved profile changes?"))
    )
      onClose();
  };
  return (
    <Modal title="Profile information" onClose={close}>
      <form
        className="writer-profile-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const { response, data } = await requestJson(
              "/api/writer/profile",
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...form,
                  pronouns: pronouns
                    .split(",")
                    .map((p) => p.trim())
                    .filter(Boolean),
                  expectedUpdatedAt: profile.updatedAt,
                }),
              },
            );
            if (!response.ok) throw new Error(data.error);
            update(data.profile);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Profile update failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Profile information</h2>
        <div className={`profile-edit-cover accent-${form.accent || "forest"}`}>
          <span>Your writer identity</span>
          <b>✦</b>
        </div>
        <label>Photo</label>
        <div className="writer-photo-edit">
          <WriterAvatar profile={form} size={80} />
          <div>
            <label className="writer-upload-label">
              Update
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 500000)
                    return setError("Choose a photo under 500 KB.");
                  const reader = new FileReader();
                  reader.onload = () => {
                    setForm((old) => ({
                      ...old,
                      avatar: String(reader.result),
                    }));
                    setError("");
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <button
              type="button"
              className="writer-text-button danger"
              disabled={busy}
              onClick={() => setForm({ ...form, avatar: "" })}
            >
              Remove
            </button>
            <p className="writer-fine-print">
              Square JPG, PNG or WebP. Up to 500 KB.
            </p>
          </div>
        </div>
        <label>
          Name*
          <input
            autoComplete="name"
            value={form.name}
            maxLength={50}
            required
            disabled={busy}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <small>{form.name.length}/50</small>
        </label>
        <label>
          Pronouns
          <input
            placeholder="he/him, she/her, they/them"
            value={pronouns}
            disabled={busy}
            onChange={(e) => setPronouns(e.target.value)}
          />
          <small>Optional · up to four, separated by commas</small>
        </label>
        <label>
          Short bio
          <textarea
            value={form.bio}
            maxLength={160}
            rows={3}
            disabled={busy}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
          <small>{form.bio.length}/160</small>
        </label>
        <label>
          Website
          <input
            type="url"
            placeholder="https://your-website.com"
            value={form.website}
            disabled={busy}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </label>
        <fieldset className="profile-accent-choices">
          <legend>Profile accent</legend>
          {["forest", "copper", "violet", "ink"].map((accent) => (
            <label key={accent} className={`accent-${accent}`}>
              <input
                type="radio"
                name="profile-accent"
                value={accent}
                checked={(form.accent || "forest") === accent}
                disabled={busy}
                onChange={() =>
                  setForm({ ...form, accent: accent as typeof form.accent })
                }
              />
              {accent}
            </label>
          ))}
        </fieldset>
        <hr />
        <label>
          About page
          <textarea
            value={form.about}
            maxLength={5000}
            rows={5}
            disabled={busy}
            placeholder="Your story, experience and interests…"
            onChange={(e) => setForm({ ...form, about: e.target.value })}
          />
          <small>{form.about.length}/5,000</small>
        </label>
        <p className="writer-fine-print">
          These details appear on your public writer profile. Your student
          profile and account email remain separate.
        </p>
        <label className="writer-connections-choice">
          <input
            type="checkbox"
            checked={!!form.showConnections}
            disabled={busy}
            onChange={(e) =>
              setForm({ ...form, showConnections: e.target.checked })
            }
          />
          <span>
            Show my writer connections on my public profile.
            <small>
              Off by default. This displays names, photos and links for verified
              public writers you follow and who follow you. Student identities
              and account emails stay private.
            </small>
          </span>
        </label>
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <div className="writer-dialog-actions">
          <button
            type="button"
            className="btn light"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button className="btn dark" disabled={busy || !changed}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ProfileContent() {
  const { profile } = useWriter();
  const [tab, setTab] = useState("home"),
    [edit, setEdit] = useState(false),
    [stories, setStories] = useState<Story[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    requestJson("/api/stories")
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error);
        setStories(data.stories.filter((s: Story) => s.status === "published"));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="writer-content-layout">
      <section className="writer-primary">
        <div
          className={`writer-profile-cover accent-${profile.accent || "forest"}`}
        >
          <span>YOUR VOICE ON SYAAHI</span>
          <b>✦</b>
        </div>
        <div className="writer-profile-hero-avatar">
          <WriterAvatar profile={profile} size={92} />
        </div>
        <div className="writer-page-heading">
          <h1>{profile.name}</h1>
          <a className="writer-text-button" href={`/creators/${profile.slug}`}>
            Public profile ↗
          </a>
        </div>
        <p className="writer-profile-bio">
          {profile.bio ||
            "Give readers a little glimpse of the person behind the words."}
        </p>
        <div
          className="writer-tabs"
          role="tablist"
          aria-label="Profile sections"
        >
          <button
            role="tab"
            aria-selected={tab === "home"}
            onClick={() => setTab("home")}
          >
            Home
          </button>
          <button
            role="tab"
            aria-selected={tab === "about"}
            onClick={() => setTab("about")}
          >
            About
          </button>
          <button
            role="tab"
            aria-selected={tab === "connections"}
            onClick={() => setTab("connections")}
          >
            Connections
          </button>
        </div>
        {tab === "connections" ? (
          <ConnectionsPanel key={profile.owner} />
        ) : tab === "about" ? (
          <div className="writer-about">
            <h2>A little about me</h2>
            <p>
              {profile.about ||
                "Tell readers about your interests, your experience and the ideas you care about."}
            </p>
            <button
              className="writer-text-button"
              onClick={() => setEdit(true)}
            >
              Edit your About page
            </button>
          </div>
        ) : loading ? (
          <p role="status">Loading your stories…</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : stories.length ? (
          stories.map((s) => <StoryRow key={s.id} story={s} />)
        ) : (
          <div className="writer-empty">
            <span className="writer-empty-symbol">✎</span>
            <h2>Your story starts here.</h2>
            <p>Your published work will live on this page.</p>
            <a className="btn light" href="/write">
              Write a story
            </a>
          </div>
        )}
      </section>
      <aside className="writer-right-rail">
        <WriterAvatar profile={profile} size={88} />
        <h3>
          {profile.name} <small>{profile.pronouns.join(" · ")}</small>
        </h3>
        <p>{profile.bio || "Add a short bio to introduce yourself."}</p>
        {profile.website && (
          <p>
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              Visit website ↗
            </a>
          </p>
        )}
        <button className="writer-text-button" onClick={() => setEdit(true)}>
          Edit profile
        </button>
        <hr />
        <p className="writer-fine-print">
          Writing on Syaahi since{" "}
          {new Date(profile.joinedAt).toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </aside>
      {edit && <ProfileEditor onClose={() => setEdit(false)} />}
    </div>
  );
}
export default function WriterProfileView() {
  return (
    <WriterShell>
      <ProfileContent />
    </WriterShell>
  );
}
