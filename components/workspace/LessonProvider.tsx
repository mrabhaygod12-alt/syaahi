"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { LessonJob } from "./types";
import { touchStudyDay } from "@/lib/study/streak";

interface Ctx {
  id: string;
  job: LessonJob | null;
  loading: boolean;
  balance: number | null;
  refresh: () => Promise<void>;
  markComplete: (index: number, on?: boolean) => void;
  setTemplate: (id: string) => void;
  // Slide-over AI chat controller: any room can open the drawer,
  // optionally with a prefilled question (e.g. selected note text).
  chatOpen: boolean;
  chatPrefill: { text: string; nonce: number } | null;
  openChat: (prefill?: string) => void;
  closeChat: () => void;
}

const LessonCtx = createContext<Ctx | null>(null);

export function useLesson() {
  const v = useContext(LessonCtx);
  if (!v) throw new Error("useLesson must be inside LessonProvider");
  return v;
}

export default function LessonProvider({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const [job, setJob] = useState<LessonJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState<{
    text: string;
    nonce: number;
  } | null>(null);

  const openChat = useCallback((prefill?: string) => {
    if (prefill?.trim())
      setChatPrefill({ text: prefill.trim().slice(0, 500), nonce: Date.now() });
    setChatOpen(true);
  }, []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/jobs/${id}`);
      const j = await r.json();
      setJob(j.error && !j.id ? null : j);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (document.hidden) {
        timer = setTimeout(tick, 5000);
        return;
      }
      try {
        const r = await fetch(`/api/jobs/${id}`);
        const j = await r.json();
        if (!alive) return;
        setJob(j.error && !j.id ? null : j);
        setLoading(false);
        if (j.status === "working" || j.status === "queued")
          timer = setTimeout(tick, 2200);
      } catch {
        if (alive) setLoading(false);
      }
    };
    tick();
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    fetch("/api/credits")
      .then((r) => r.json())
      .then((j) => setBalance(j.balance))
      .catch(() => {});
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id]);

  useEffect(() => {
    if (!job || job.status !== "done") return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/jobs/${id}?revision=1`);
        if (r.status === 404) {
          setJob(null);
          return;
        }
        const latest = await r.json();
        if (latest.revision !== (job.revision || 0)) await load();
      } catch {
        /* Retry on next visible tick. */
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [id, job?.status, job?.revision, load]);

  const persistProgress = useCallback(
    async (completed: number[], lastRoom?: string, pdfTemplate?: string) => {
      await fetch(`/api/jobs/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "progress",
          completed,
          lastRoom,
          pdfTemplate,
        }),
      }).catch(() => {});
    },
    [id],
  );

  const markComplete = useCallback(
    (index: number, on = true) => {
      if (on) touchStudyDay();
      setJob((cur) => {
        if (!cur) return cur;
        const set = new Set(cur.progress?.completed ?? []);
        if (on) set.add(index);
        else set.delete(index);
        const completed = [...set].sort((a, b) => a - b);
        const next = {
          ...cur,
          progress: { ...(cur.progress ?? { completed: [] }), completed },
        };
        persistProgress(
          completed,
          cur.progress?.lastRoom,
          cur.pdfTemplate ?? undefined,
        );
        return next;
      });
    },
    [persistProgress],
  );

  const setTemplate = useCallback(
    (tpl: string) => {
      setJob((cur) => {
        if (!cur) return cur;
        persistProgress(
          cur.progress?.completed ?? [],
          cur.progress?.lastRoom,
          tpl,
        );
        return { ...cur, pdfTemplate: tpl };
      });
    },
    [persistProgress],
  );

  const value = useMemo(
    () => ({
      id,
      job,
      loading,
      balance,
      refresh: load,
      markComplete,
      setTemplate,
      chatOpen,
      chatPrefill,
      openChat,
      closeChat,
    }),
    [
      id,
      job,
      loading,
      balance,
      load,
      markComplete,
      setTemplate,
      chatOpen,
      chatPrefill,
      openChat,
      closeChat,
    ],
  );

  return <LessonCtx.Provider value={value}>{children}</LessonCtx.Provider>;
}
