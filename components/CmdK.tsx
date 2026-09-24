"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  label: string;
  hint: string;
  run: () => void;
}

const ROOMS = [
  { id: "learn", label: "Learn" },
  { id: "notes", label: "Notes" },
  { id: "quiz", label: "Quiz" },
  { id: "flashcards", label: "Flashcards" },
  { id: "podcast", label: "Podcast" },
  { id: "source", label: "Source" },
];

// Cmd/Ctrl+K: jump to rooms, lessons, dashboard. Power-user speed.
export default function CmdK() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [lessons, setLessons] = useState<Array<{ id: string; title: string }>>(
    [],
  );
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((j) => {
        setLessons(
          ((j.jobs ?? []) as any[])
            .slice(0, 10)
            .map((x) => ({
              id: x.id,
              title: x.title ?? x.topics?.[0] ?? "Lesson",
            })),
        );
      })
      .catch(() => {});
    setQ("");
    setActive(0);
  }, [open]);

  const [curId, setCurId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (open) {
      const m = window.location.pathname.match(/\/lesson\/([^/]+)/);
      setCurId(m?.[1]);
    }
  }, [open]);

  const items: Item[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all: Item[] = [
      {
        label: "Go to Dashboard",
        hint: "page",
        run: () => router.push("/dashboard"),
      },
      ...(curId
        ? ROOMS.map((r) => ({
            label: `Room: ${r.label}`,
            hint: "this lesson",
            run: () => router.push(`/lesson/${curId}/${r.id}`),
          }))
        : []),
      ...lessons.map((l) => ({
        label: l.title.slice(0, 60),
        hint: "lesson",
        run: () => router.push(`/lesson/${l.id}/learn`),
      })),
    ];
    const f = needle
      ? all.filter((x) => x.label.toLowerCase().includes(needle))
      : all;
    return f.slice(0, 12);
  }, [q, lessons, curId, router]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;
  return (
    <div className="cmdk-backdrop" onClick={() => setOpen(false)}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Jump to room, lesson… (Esc to close)"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            }
            if (e.key === "Enter" && items[active]) {
              setOpen(false);
              items[active].run();
            }
          }}
        />
        {items.map((it, k) => (
          <button
            key={k}
            className={`cmdk-item${k === active ? " active" : ""}`}
            onClick={() => {
              setOpen(false);
              it.run();
            }}
          >
            <span style={{ flex: 1 }}>{it.label}</span>
            <span className="small">{it.hint}</span>
          </button>
        ))}
        {!items.length && (
          <p className="small" style={{ padding: "8px 12px" }}>
            No matches.
          </p>
        )}
      </div>
    </div>
  );
}
