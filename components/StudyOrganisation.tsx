"use client";
import { useEffect, useState } from "react";
interface Folder {
  id: string;
  name: string;
  lessons: string[];
}
export default function StudyOrganisation({
  lessons,
  onFilter,
}: {
  lessons: Array<{ id: string; title: string }>;
  onFilter: (ids: string[] | null) => void;
}) {
  const [folders, setFolders] = useState<Folder[]>([]),
    [selected, setSelected] = useState(""),
    [name, setName] = useState(""),
    [move, setMove] = useState(""),
    [error, setError] = useState(""),
    [weak, setWeak] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/study")
      .then((r) => r.json())
      .then((d) => {
        setFolders(d.folders || []);
        setWeak(d.attempts?.[0]?.weak?.slice(0, 3) || []);
      })
      .catch(() => setError("Folders could not be loaded."));
  }, []);
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
  return (
    <div className="study-organisation">
      {weak.length > 0 && (
        <details className="card">
          <summary>Revisit these ideas from your latest quiz</summary>
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
