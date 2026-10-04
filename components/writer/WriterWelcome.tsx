"use client";
import { useEffect, useState } from "react";
import WriterShell, { useWriter } from "./WriterShell";
import { requestJson } from "@/lib/http-client";
import type { Story } from "@/lib/writing/stories";
function Welcome() {
  const { profile } = useWriter(),
    [stories, setStories] = useState<Story[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    requestJson("/api/stories")
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error);
        setStories(data.stories);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  const draft = stories.find((s) =>
    ["draft", "changes_requested"].includes(s.status),
  );
  return (
    <div className="writer-welcome">
      <section className="writer-welcome-hero">
        <div>
          <p className="writer-kicker">YOUR WRITING HOME</p>
          <p className="writer-welcome-greeting">
            Good to see you, {profile.name.split(" ")[0]}.
          </p>
          <h1>
            Make room
            <br />
            for your <em>next idea.</em>
          </h1>
          <p>
            A quiet place to think, a thoughtful editor to create, and a public
            home for the stories you stand behind.
          </p>
          <div className="hero-actions">
            <a
              className="btn dark"
              href={draft ? `/write?draft=${draft.id}` : "/write"}
            >
              {draft ? "Continue your draft" : "Write your first story"} ↗
            </a>
            <a className="btn light" href="/writer">
              Discover stories
            </a>
          </div>
        </div>
        <div className="welcome-paper-scene" aria-hidden="true">
          <span className="welcome-orbit orbit-one" />
          <span className="welcome-orbit orbit-two" />
          <div className="welcome-paper">
            <span>SYAAHI / A NEW CHAPTER</span>
            <h2>
              Every great story
              <br />
              starts with
              <br />
              <em>a little curiosity.</em>
            </h2>
            <i />
            <i />
            <i />
            <b>✦</b>
          </div>
          <div className="welcome-note">
            Your voice.
            <br />
            Your perspective.
          </div>
        </div>
      </section>
      <section className="welcome-work-grid">
        {[
          [
            "01",
            "Create",
            "Your private drafts, ready for the next sentence.",
            "/writer/stories",
            "Open your stories",
          ],
          [
            "02",
            "Read",
            "Keep the ideas you want to return to.",
            "/writer/library",
            "Open your library",
          ],
          [
            "03",
            "Be known",
            "A profile that tells readers who you are.",
            "/writer/profile",
            "Shape your profile",
          ],
        ].map(([n, title, copy, href, label]) => (
          <a className="welcome-work-card" key={href} href={href}>
            <span>{n}</span>
            <h2>{title}</h2>
            <p>{copy}</p>
            <strong>{label} ↗</strong>
          </a>
        ))}
      </section>
      <section className="welcome-last-draft">
        <div>
          <p className="writer-kicker">PICK UP THE THREAD</p>
          <h2>{draft?.title || "A blank page, a fresh beginning."}</h2>
          <p>
            {draft?.summary ||
              "Your ideas are saved privately as you write. Take your time."}
          </p>
          {error && <p role="alert">{error}</p>}
        </div>
        <a
          className="btn light"
          href={draft ? `/write?draft=${draft.id}` : "/write"}
        >
          {!loaded
            ? "Open your editor"
            : draft
              ? "Continue writing"
              : "Start a new story"}{" "}
          →
        </a>
      </section>
    </div>
  );
}
export default function WriterWelcome() {
  return (
    <WriterShell>
      <Welcome />
    </WriterShell>
  );
}
