"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "./WorkspaceProvider";
import { requestJson } from "@/lib/http-client";
import StudyComposer from "./StudyComposer";
import StudyOrganisation from "./StudyOrganisation";
import type { hubView } from "@/lib/study/hub";
import "./student-dashboard.css";
type Hub = Awaited<ReturnType<typeof hubView>>;
type Lesson = {
  id: string;
  title: string | null;
  topics: string[];
  status: string;
  done: number;
  total: number;
};
export default function StudentDashboard() {
  const { user } = useAccount();
  const [hub, setHub] = useState<Hub | null>(null),
    [jobs, setJobs] = useState<Lesson[]>([]),
    [credits, setCredits] = useState<number | null>(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [topic, setTopic] = useState(""),
    [folder, setFolder] = useState<string[] | null>(null),
    [tab, setTab] = useState("today"),
    [busy, setBusy] = useState(false),
    [revealed, setRevealed] = useState(false),
    [ledger, setLedger] = useState<any[]>([]),
    [documents, setDocuments] = useState<any[]>([]);
  const [shared, setShared] = useState<
    Array<{ id: string; title: string; sections: number }>
  >([]);
  const load = useCallback(async () => {
    const r = await requestJson("/api/student/hub");
    if (r.response.status === 401) return;
    if (!r.response.ok) throw new Error(r.data.error);
    setHub(r.data as Hub);
    const [j, c] = await Promise.all([
      requestJson("/api/jobs"),
      requestJson("/api/credits"),
    ]);
    if (j.response.ok) setJobs(j.data.jobs || []);
    if (c.response.ok) setCredits(c.data.balance);
    const collaborations = await requestJson("/api/collaboration");
    if (collaborations.response.ok)
      setShared(collaborations.data.lessons || []);
    setError("");
  }, []);
  useEffect(() => {
    const initial = new URLSearchParams(location.search).get("topic");
    if (initial) {
      setTopic(initial);
      setTab("create");
    }
    void load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    if (!jobs.some((j) => ["queued", "working"].includes(j.status))) return;
    const timer = setTimeout(
      () => void load().catch((e) => setError(e.message)),
      10000,
    );
    return () => clearTimeout(timer);
  }, [jobs, load]);
  useEffect(() => {
    if (query.trim().length < 2) return;
    let alive = true;
    const timer = setTimeout(
      () =>
        void requestJson("/api/student/hub?q=" + encodeURIComponent(query))
          .then(({ response, data }) => {
            if (alive && response.ok) setHub(data as Hub);
          })
          .catch((e) => alive && setError(e.message)),
      350,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);
  async function change(body: unknown) {
    setBusy(true);
    try {
      const { response, data } = await requestJson("/api/student/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(data.error);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const current = hub?.continue,
    card = hub?.due[0];
  const titles: Record<string, string> = {
    create: "Make something click.",
    library: "Your learning library.",
    review: "A little recall, every day.",
    planner: "Make room for your exam.",
    sources: "Your private sources.",
    wallet: "Every credit, accounted for.",
  };
  return (
    <div className="student-hub">
      <aside className="hub-rail">
        <p className="hub-wordmark">✦ Your study space</p>
        <nav aria-label="Study workspace">
          {[
            ["today", "Today"],
            ["create", "Create lesson"],
            ["library", "Library"],
            ["review", "Review"],
            ["planner", "Exam planner"],
            ["sources", "Sources"],
            ["wallet", "Credits"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
            >
              {label}
              {key === "review" && !!hub?.dueCount && (
                <small>{hub.dueCount}</small>
              )}
            </button>
          ))}
          <a href="/presentations">Presentation studio ↗</a>
          <a href="/interview">Interview practice ↗</a>
        </nav>
        <a className="hub-rail-bottom" href="/account/billing">
          Manage membership
        </a>
      </aside>
      <div className="hub-body">
        <header className="hub-top">
          <div>
            <p className="eyebrow">LEARN WITH INTENTION</p>
            <h1>
              {tab === "today"
                ? `Your next step${user?.name ? ", " + user.name.split(" ")[0] : ""}.`
                : titles[tab]}
            </h1>
          </div>
          <a className="hub-balance" href="/pricing">
            {credits ?? "…"}
            <span>available credits</span>
          </a>
        </header>
        <div className="hub-tools">
          <input
            aria-label="Search your lesson content"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, sources and flashcards…"
          />
          <button
            className="btn dark"
            onClick={() => {
              setQuery("");
              setTab("create");
            }}
          >
            ＋ New lesson
          </button>
        </div>
        {error && (
          <div role="alert" className="hub-error">
            {error}
            <button
              onClick={() => void load().catch((e) => setError(e.message))}
            >
              Retry
            </button>
          </div>
        )}
        {query.trim().length >= 2 ? (
          <section className="hub-panel">
            <h2>Private material search</h2>
            <p>Searches your latest 100 owned lessons.</p>
            {hub?.results.map((r, i) => (
              <a
                className="hub-result"
                key={i}
                href={`/lesson/${r.lesson}/${r.room}#page-${r.section + 1}`}
              >
                <small>{r.room}</small>
                <h3>{r.title}</h3>
                <p>{r.snippet}</p>
              </a>
            ))}
            {!hub?.results.length && <p>No matching passage yet.</p>}
          </section>
        ) : (
          <>
            {tab === "today" && (
              <>
                <section className="hub-summary">
                  <article>
                    <strong>{hub?.dueCount ?? "…"}</strong>
                    <p>cards due</p>
                    <button onClick={() => setTab("review")}>
                      Start recall →
                    </button>
                  </article>
                  <article>
                    <strong>{hub?.streak ?? 0}</strong>
                    <p>day study streak</p>
                    <small>Saved reviews and quizzes count.</small>
                  </article>
                  <article>
                    <strong>
                      {jobs.filter((j) => j.status === "done").length}
                    </strong>
                    <p>ready lessons</p>
                    <button onClick={() => setTab("library")}>
                      Open library →
                    </button>
                  </article>
                </section>
                <section className="hub-continue">
                  <div>
                    <p className="eyebrow">CONTINUE LEARNING</p>
                    <h2>
                      {current?.title || "One question can change your day."}
                    </h2>
                    <p>
                      {current
                        ? `${current.completed}/${current.total} sections marked complete. Return to your saved room.`
                        : "Bring a chapter, a lecture or a topic. Review your outline before using credits."}
                    </p>
                  </div>
                  {current ? (
                    <a
                      className="btn dark"
                      href={`/lesson/${current.id}/${current.room}`}
                    >
                      Continue lesson ↗
                    </a>
                  ) : (
                    <button
                      className="btn dark"
                      onClick={() => setTab("create")}
                    >
                      Create your first lesson
                    </button>
                  )}
                </section>
                <div className="hub-split">
                  <section className="hub-panel">
                    <p className="eyebrow">WHAT TO REVISIT</p>
                    <h2>Practice insights</h2>
                    {hub?.weak.map((w) => (
                      <button
                        className="hub-result"
                        key={w.topic}
                        onClick={() => {
                          setTopic(w.topic);
                          setTab("create");
                        }}
                      >
                        <h3>{w.topic}</h3>
                        <p>
                          Missed in {w.evidence} saved attempt
                          {w.evidence === 1 ? "" : "s"}. Create focused notes →
                        </p>
                      </button>
                    ))}
                    {!hub?.weak.length && (
                      <p>
                        Complete a quiz for evidence-based recommendations.
                        Practice results are not exam grades.
                      </p>
                    )}
                  </section>
                  <section className="hub-panel">
                    <p className="eyebrow">UPCOMING</p>
                    <h2>Your exam plan</h2>
                    {hub?.state.exams.slice(0, 3).map((ex) => (
                      <button
                        className="hub-result"
                        key={ex.id}
                        onClick={() => setTab("planner")}
                      >
                        <h3>{ex.name}</h3>
                        <p>
                          {ex.date} · {ex.tasks.filter((t) => !t.done).length}{" "}
                          topics remaining
                        </p>
                      </button>
                    ))}
                    {!hub?.state.exams.length && (
                      <p>
                        Give revision a realistic date and a daily time budget.
                      </p>
                    )}
                    <button
                      className="btn light"
                      onClick={() => setTab("planner")}
                    >
                      Plan your study →
                    </button>
                  </section>
                </div>
              </>
            )}
            {tab === "create" && (
              <section className="hub-panel hub-composer">
                <p className="eyebrow">INPUT → OUTLINE → CONFIRM → GENERATE</p>
                <StudyComposer
                  initialTopic={topic}
                  onCreated={() => void load()}
                />
              </section>
            )}
            {tab === "library" && (
              <section className="hub-panel">
                <StudyOrganisation
                  lessons={jobs.map((j) => ({
                    id: j.id,
                    title: j.title || j.topics[0],
                  }))}
                  onFilter={setFolder}
                />
                <div className="hub-lessons">
                  {jobs
                    .filter((j) => folder === null || folder.includes(j.id))
                    .map((j) => (
                      <a key={j.id} href={`/lesson/${j.id}/notes`}>
                        <small>
                          {j.status === "done"
                            ? "READY TO STUDY"
                            : j.status.toUpperCase()}
                        </small>
                        <h2>{j.title || j.topics[0]}</h2>
                        <p>
                          {j.done}/{j.total} sections
                        </p>
                        <span>Open lesson ↗</span>
                      </a>
                    ))}
                </div>
                {!jobs.length && <p>Create a lesson to begin your library.</p>}
                {!!shared.length && (
                  <>
                    <h2>Shared with you</h2>
                    <div className="hub-lessons">
                      {shared.map((j) => (
                        <a key={j.id} href={`/lesson/${j.id}/notes`}>
                          <small>SHARED LESSON</small>
                          <h2>{j.title}</h2>
                          <p>{j.sections} sections</p>
                          <span>Open lesson ↗</span>
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
            {tab === "review" && (
              <section className="hub-panel hub-review">
                <p className="eyebrow">ONE QUEUE, ALL YOUR LESSONS</p>
                <h2>{card ? card.front : "You’re caught up."}</h2>
                {card ? (
                  <>
                    <p>{card.title}</p>
                    {revealed ? (
                      <>
                        <div className="hub-answer">{card.back}</div>
                        <div className="hub-ratings">
                          {["again", "hard", "good", "easy"].map((r) => (
                            <button
                              className="btn light"
                              disabled={busy}
                              key={r}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  const { response, data } = await requestJson(
                                    "/api/study",
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        action: "review",
                                        lesson: card.lesson,
                                        index: card.index,
                                        rating: r,
                                        event: crypto.randomUUID(),
                                      }),
                                    },
                                  );
                                  if (!response.ok) throw new Error(data.error);
                                  setRevealed(false);
                                  await load();
                                } catch (e) {
                                  setError(String(e));
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <button
                        className="btn dark"
                        onClick={() => setRevealed(true)}
                      >
                        Reveal answer
                      </button>
                    )}
                    <p>
                      {hub?.dueCount} cards due. Ratings save to your account.
                    </p>
                  </>
                ) : (
                  <p>Cards appear when a lesson has practice material ready.</p>
                )}
              </section>
            )}
            {tab === "planner" && (
              <section className="hub-panel">
                <form
                  className="hub-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      b = Object.fromEntries(new FormData(form));
                    void change({ action: "exam", ...b }).then((ok) => {
                      if (ok) form.reset();
                    });
                  }}
                >
                  <h2>Build a revision plan</h2>
                  <label>
                    Exam name
                    <input name="name" required maxLength={100} />
                  </label>
                  <label>
                    Exam date
                    <input
                      type="date"
                      name="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                  <label>
                    Minutes per day
                    <input
                      name="minutes"
                      type="number"
                      min={10}
                      max={480}
                      defaultValue={30}
                    />
                  </label>
                  <label>
                    Topics, one per line
                    <textarea name="topics" required rows={5} />
                  </label>
                  <p>
                    Topics are distributed before your exam. Allow around 30
                    minutes per topic and adjust for your course.
                  </p>
                  <button className="btn dark" disabled={busy}>
                    Save plan
                  </button>
                </form>
                {hub?.state.exams.map((ex) => (
                  <article className="hub-exam" key={ex.id}>
                    <h2>
                      {ex.name} · {ex.date}
                    </h2>
                    <p>
                      {ex.minutes} minutes/day ·{" "}
                      {ex.tasks.filter((t) => t.done).length}/{ex.tasks.length}{" "}
                      complete
                    </p>
                    {ex.tasks.filter((t) => !t.done).length * 30 >
                      Math.max(
                        1,
                        (Date.parse(ex.date) - Date.now()) / 86400000,
                      ) *
                        ex.minutes && (
                      <p role="status">
                        This plan may be overloaded. Increase your time budget
                        or reduce the scope.
                      </p>
                    )}
                    <ul>
                      {ex.tasks.map((t) => (
                        <li key={t.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={t.done}
                              disabled={busy}
                              onChange={(e) =>
                                void change({
                                  action: "exam-task",
                                  exam: ex.id,
                                  task: t.id,
                                  done: e.target.checked,
                                })
                              }
                            />
                            <span>
                              {t.topic}
                              <small>{t.date}</small>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <button
                      className="btn light"
                      disabled={busy}
                      onClick={() =>
                        void change({ action: "exam-replan", exam: ex.id })
                      }
                    >
                      Redistribute unfinished topics
                    </button>
                    <button
                      className="btn light"
                      disabled={busy}
                      onClick={() =>
                        void change({ action: "exam-delete", exam: ex.id })
                      }
                    >
                      Remove plan
                    </button>
                  </article>
                ))}
              </section>
            )}
            {tab === "wallet" && (
              <section className="hub-panel">
                <h2>Shared generation wallet</h2>
                <p>
                  Planning is free. Lesson generation reserves one credit per
                  section; presentations cost five credits. Captured monthly
                  payments top up the same student/writer wallet.
                </p>
                <button
                  className="btn light"
                  onClick={() =>
                    void requestJson("/api/credits/ledger")
                      .then(({ response, data }) =>
                        response.ok
                          ? setLedger(data.entries)
                          : setError(data.error),
                      )
                      .catch((e) => setError(e.message))
                  }
                >
                  Load latest 100 events
                </button>
                <ul className="hub-ledger">
                  {ledger.map((l, i) => (
                    <li key={i}>
                      <strong>
                        {l.delta > 0 ? "+" : ""}
                        {l.delta}
                      </strong>
                      <span>
                        {l.reason}
                        <small>
                          {new Date(l.at).toLocaleString()} · {l.reference}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
                <a href="/account/billing">Billing and receipts →</a>
              </section>
            )}
            {tab === "sources" && (
              <section className="hub-panel">
                <h2>Source retention</h2>
                <p>
                  Extracted PDFs are private. Deleting a source stops file
                  retrieval; generated notes may retain quoted text until you
                  delete the lesson. Provider backups have their own retention
                  period.
                </p>
                <button
                  className="btn light"
                  onClick={() =>
                    void requestJson("/api/documents")
                      .then(({ response, data }) =>
                        response.ok
                          ? setDocuments(data.documents)
                          : setError(data.error),
                      )
                      .catch((e) => setError(e.message))
                  }
                >
                  Load saved sources
                </button>
                {documents.map((d) => (
                  <article className="hub-source" key={d.id}>
                    <h3>{d.name}</h3>
                    <p>{d.pageCount} pages · private</p>
                    <a
                      href={`/api/documents/${d.id}?page=1`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View extracted page
                    </a>
                    <button
                      className="btn light"
                      onClick={async () => {
                        if (
                          !confirm(
                            "Delete this source? Existing generated lesson text remains.",
                          )
                        )
                          return;
                        try {
                          const { response, data } = await requestJson(
                            `/api/documents/${d.id}`,
                            { method: "DELETE" },
                          );
                          if (!response.ok) throw new Error(data.error);
                          setDocuments(documents.filter((x) => x.id !== d.id));
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    >
                      Delete source
                    </button>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
