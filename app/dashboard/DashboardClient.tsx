"use client";
import { tokenLabel } from "@/lib/billing/packs";
import { useEffect, useState } from "react";
import StudyOrganisation from "@/components/StudyOrganisation";
import StudyComposer from "@/components/StudyComposer";
import CmdK from "@/components/CmdK";
import ReferralWallet from "@/components/ReferralWallet";
interface Job {
  id: string;
  title: string | null;
  topics: string[];
  status: string;
  done: number;
  total: number;
  createdAt: string;
}
export default function DashboardClient() {
  const [shared, setShared] = useState<
    Array<{ id: string; title: string; sections: number }>
  >([]);
  const [jobs, setJobs] = useState<Job[]>([]),
    [balance, setBalance] = useState<number | null>(null),
    [query, setQuery] = useState(""),
    [topic, setTopic] = useState(""),
    [error, setError] = useState(""),
    [guest, setGuest] = useState(false),
    [folderIds, setFolderIds] = useState<string[] | null>(null);
  useEffect(() => {
    setTopic(new URLSearchParams(location.search).get("topic") || "");
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      if (document.hidden) return;
      try {
        const [j, c] = await Promise.all([
          fetch("/api/jobs"),
          fetch("/api/credits"),
        ]);
        if (!alive) return;
        if (j.status === 401) {
          setGuest(true);
          return;
        }
        if (!j.ok) throw new Error("Your lessons could not be loaded.");
        const nextJobs = (await j.json()).jobs || [];
        setJobs(nextJobs);
        if (
          nextJobs.some((job: Job) =>
            ["queued", "working"].includes(job.status),
          )
        ) {
          timer = setTimeout(load, 10000);
        }
        if (c.ok) setBalance((await c.json()).balance);
      } catch (e) {
        if (alive) setError(String(e));
      }
    }
    void load();
    fetch("/api/collaboration")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setShared(d.lessons || []);
      })
      .catch(() => {});
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return (
    <>
      <CmdK />
      <div className="workspace-grid wrap">
        <aside className="workspace-sidebar">
          <p className="eyebrow">YOUR SPACE</p>
          <a className="sidebar-active" href="/dashboard">
            ✦ Create & learn
          </a>
          <a href="#lessons">
            ▤ My lessons <span>{jobs.length}</span>
          </a>
          <a href="/refer">↗ Invite & earn</a>
          <a href="/subjects">◉ Explore subjects</a>
          <a href="/interview">↗ Interview practice</a>
          <div className="sidebar-tip">
            <span className="eyebrow">A BETTER STUDY LOOP</span>
            <p>
              Understand it.
              <br />
              Recall it.
              <br />
              Make it yours.
            </p>
            <a href="/docs">Open the study guide →</a>
          </div>
          <a className="wallet-link" href="/pricing">
            {balance === null
              ? "Your study tokens"
              : `${tokenLabel(balance)} · ${balance} sections`}{" "}
            <span>＋</span>
          </a>
        </aside>
        <div className="workspace-main">
          <div
            className="workspace-heading"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <span className="eyebrow">THE STUDY WORKSPACE</span>
              <span className="badge">Notes · Practice · Recall</span>
            </div>
            {!guest && (
              <a
                href="/pricing"
                title="Your available study balance. 1 Token = 3 Note Sections."
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                  border: "1.5px solid #fde68a",
                  borderRadius: 24,
                  padding: "6px 16px",
                  color: "#92400e",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  textDecoration: "none",
                  boxShadow: "0 2px 8px rgba(245, 158, 11, 0.15)",
                }}
              >
                <span>⚡ Remaining Balance:</span>
                <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "#b45309" }}>
                  {balance === null
                    ? "Loading..."
                    : `${Math.floor(balance / 3)} Tokens (${balance} Credits)`}
                </span>
                <span
                  style={{
                    background: "#b45309",
                    color: "#fff",
                    borderRadius: "50%",
                    width: 20,
                    height: 20,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                  }}
                >
                  ＋
                </span>
              </a>
            )}
          </div>
          <section className="composer-intro">
            <span className="ink-symbol">✦</span>
            <h1>
              What will you
              <br />
              <em>understand today?</em>
            </h1>
            <p>
              Start with a question. Bring your material. Build a clearer
              picture.
            </p>
          </section>
          <StudyComposer initialTopic={topic} />
          {!guest && <ReferralWallet compact />}
          {guest && (
            <p className="guest-hint">
              <a href="/signup">Create a free account</a> to save your lessons
              and get 21 welcome credits (7 tokens).
            </p>
          )}
          <div className="topic-suggestions">
            Try a starting point
            {["Cyber forensics", "Binary search", "Photosynthesis"].map((t) => (
              <button key={t} onClick={() => setTopic(t)}>
                {t} ↗
              </button>
            ))}
          </div>
          <section id="lessons" className="lessons-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">KEEP YOUR MOMENTUM</span>
                <h2>Your lessons</h2>
              </div>
              <input
                aria-label="Search lessons"
                placeholder="Search your lessons..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
            {!guest && (
              <StudyOrganisation
                lessons={jobs.map((j) => ({
                  id: j.id,
                  title: j.title || j.topics[0],
                }))}
                onFilter={setFolderIds}
              />
            )}
            <div className="lesson-grid">
              {jobs
                .filter(
                  (j) =>
                    (folderIds === null || folderIds.includes(j.id)) &&
                    (j.title || j.topics.join(" "))
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((j) => (
                  <a
                    className="lesson-tile"
                    href={`/lesson/${j.id}/notes`}
                    key={j.id}
                  >
                    <div className="section-heading">
                      <span className="lesson-icon">▤</span>
                      <span className={`badge status-${j.status}`}>
                        {j.status === "done" ? "Ready to study" : j.status}
                      </span>
                    </div>
                    <h3>{j.title || j.topics[0]}</h3>
                    <p>
                      {j.done} of {j.total} sections ·{" "}
                      {new Date(j.createdAt).toLocaleDateString()}
                    </p>
                    <span className="lesson-open">Open workspace ↗</span>
                  </a>
                ))}
            </div>
            {!jobs.length && (
              <div className="empty-lessons">
                <span>▤</span>
                <h3>Your next insight starts here.</h3>
                <p>
                  Create your first lesson above. Your notes, source material,
                  quizzes, and flashcards will stay together.
                </p>
              </div>
            )}
          </section>
          {shared.length > 0 && (
            <section className="lessons-section">
              <h2>Shared with you</h2>
              <div className="lesson-grid">
                {shared.map((j) => (
                  <a
                    className="lesson-tile"
                    key={j.id}
                    href={`/lesson/${j.id}/notes`}
                  >
                    <span className="badge">Shared lesson</span>
                    <h3>{j.title}</h3>
                    <p>{j.sections} sections</p>
                    <span>Open workspace ↗</span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
