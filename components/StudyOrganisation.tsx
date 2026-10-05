"use client";
import { useEffect, useState } from "react";
import { useAccount } from "./WorkspaceProvider";
interface Folder {
  id: string;
  name: string;
  lessons: string[];
}
interface Attempt {
  correct: number;
  total: number;
  at: string;
  weak: string[];
}
interface Reminder {
  enabled: boolean;
  hour: number;
  timezone: string;
  email?: boolean;
  history?: Array<{ day: string; status: string }>;
}
export default function StudyOrganisation({
  lessons,
  onFilter,
}: {
  lessons: Array<{ id: string; title: string }>;
  onFilter: (ids: string[] | null) => void;
}) {
  const { user } = useAccount();
  const [folders, setFolders] = useState<Folder[]>([]),
    [selected, setSelected] = useState(""),
    [name, setName] = useState(""),
    [move, setMove] = useState(""),
    [error, setError] = useState(""),
    [weak, setWeak] = useState<string[]>([]),
    [attempts, setAttempts] = useState<Attempt[]>([]),
    [reminder, setReminder] = useState<Reminder>({
      enabled: false,
      hour: 19,
      timezone: "UTC",
    }),
    [busy, setBusy] = useState(false);
  const [emailReady, setEmailReady] = useState(false);
  useEffect(() => {
    fetch("/api/study")
      .then((r) => r.json())
      .then((d) => {
        setFolders(d.folders || []);
        setWeak(d.attempts?.[0]?.weak?.slice(0, 3) || []);
        setAttempts(d.attempts || []);
        if (d.reminder && Number.isInteger(d.reminder.hour))
          setReminder(d.reminder);
        setEmailReady(d.reminderChannels?.email === true);
      })
      .catch(() => setError("Folders could not be loaded."));
  }, []);
  useEffect(() => {
    if (!reminder.enabled || !("Notification" in window)) return;
    const notifyIfDue = () => {
      const now = new Date();
      const hour = Number(
        new Intl.DateTimeFormat("en", {
          timeZone: reminder.timezone,
          hour: "numeric",
          hourCycle: "h23",
        }).format(now),
      );
      if (
        Notification.permission !== "granted" ||
        hour !== reminder.hour ||
        now.getMinutes() > 4
      )
        return;
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: reminder.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      const key = `syaahi-reminder:${user?.id}:${day}`;
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "sent");
      } catch {
        return;
      }
      new Notification("Syaahi study reminder", {
        body: "Your next small review session is ready.",
        icon: "/icon.svg",
      });
    };
    notifyIfDue();
    const timer = window.setInterval(notifyIfDue, 60_000);
    return () => window.clearInterval(timer);
  }, [reminder, user?.id]);
  async function change(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setFolders(d.folders);
      if (d.reminder) setReminder(d.reminder);
      if (selected) {
        const f = d.folders.find((f: Folder) => f.id === selected);
        onFilter(f?.lessons ?? null);
        if (!f) setSelected("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save folders.");
    } finally {
      setBusy(false);
    }
  }
  const latest = attempts[0];
  const average = attempts.length
    ? Math.round(
        (attempts.reduce(
          (sum, attempt) => sum + attempt.correct / Math.max(1, attempt.total),
          0,
        ) /
          attempts.length) *
          100,
      )
    : null;
  async function saveReminder(next: Reminder) {
    if (
      next.enabled &&
      !reminder.enabled &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(
          "Browser notifications were not allowed. Your reminder preference was not enabled.",
        );
        return;
      }
    }
    await change({
      action: "reminder",
      ...next,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
  }
  return (
    <div className="study-organisation">
      <section className="study-dashboard card" aria-label="Study progress">
        <div>
          <span className="eyebrow">STUDY DASHBOARD</span>
          <h2>
            {average === null
              ? "Start your first recall session"
              : `${average}% average across recent quizzes`}
          </h2>
          <p className="small">
            {latest
              ? `Latest result: ${latest.correct}/${latest.total} on ${new Date(latest.at).toLocaleDateString()}.`
              : "Complete a quiz to receive an adaptive review plan."}
          </p>
        </div>
        <div className="study-reminder">
          <label>
            <input
              type="checkbox"
              checked={reminder.enabled}
              disabled={busy}
              onChange={(event) =>
                void saveReminder({
                  ...reminder,
                  enabled: event.target.checked,
                })
              }
            />
            Daily browser reminder
          </label>
          <select
            aria-label="Study reminder hour"
            disabled={busy || !reminder.enabled}
            value={reminder.hour}
            onChange={(event) =>
              void saveReminder({
                ...reminder,
                hour: Number(event.target.value),
              })
            }
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option
                value={hour}
                key={hour}
              >{`${String(hour).padStart(2, "0")}:00`}</option>
            ))}
          </select>
          <p className="small">
            Works while Syaahi is open. System notifications need browser
            permission.
          </p>
          <label>
            <input
              type="checkbox"
              checked={reminder.email === true}
              disabled={busy || !emailReady}
              onChange={(e) =>
                void saveReminder({ ...reminder, email: e.target.checked })
              }
            />
            Email reminders
          </label>
          <p className="small">
            {emailReady
              ? "Background delivery available. Uncheck to unsubscribe."
              : "Email delivery needs a scheduled worker and configured sender; it is unavailable here."}{" "}
            Time zone: {reminder.timezone}
          </p>
          {reminder.history?.slice(-3).map((h) => (
            <p className="small" key={h.day}>
              {h.day}: {h.status}
            </p>
          ))}
        </div>
      </section>
      {weak.length > 0 && (
        <details className="card">
          <summary>Adaptive weak-topic plan</summary>
          <p className="small">
            These topics came from missed answers in your latest quiz. Build
            focused notes, then return to flashcards.
          </p>
          <ul>
            {weak.map((t) => (
              <li key={t}>
                <a href={`/dashboard?topic=${encodeURIComponent(t)}`}>{t}</a>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="folder-tabs">
        <button
          className={!selected ? "selected" : ""}
          onClick={() => {
            setSelected("");
            onFilter(null);
          }}
        >
          All lessons
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            className={selected === f.id ? "selected" : ""}
            onClick={() => {
              setSelected(f.id);
              onFilter(f.lessons);
            }}
          >
            {f.name} <span>{f.lessons.length}</span>
          </button>
        ))}
        <details>
          <summary>Manage folders</summary>
          <div className="card folder-manager">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void change({ action: "folder", name });
                setName("");
              }}
            >
              <input
                type="text"
                required
                maxLength={60}
                aria-label="New folder name"
                placeholder="New folder name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="btn light" disabled={busy}>
                Create folder
              </button>
            </form>
            {selected && (
              <>
                <label>
                  Move a lesson here
                  <select
                    value={move}
                    onChange={(e) => setMove(e.target.value)}
                  >
                    <option value="">Choose a lesson</option>
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn light"
                  disabled={busy || !move}
                  onClick={() =>
                    change({ action: "assign", folder: selected, lesson: move })
                  }
                >
                  Move lesson
                </button>
                <button
                  className="btn light"
                  disabled={busy}
                  onClick={() =>
                    change({ action: "delete-folder", folder: selected })
                  }
                >
                  Remove folder (keep lessons)
                </button>
              </>
            )}
          </div>
        </details>
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </div>
  );
}
