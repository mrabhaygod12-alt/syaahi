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
import { requestJson } from "@/lib/http-client";

export interface TutorContext {
  goal: string;
  version: string;
  index: number;
  phase: number;
  topic: string;
}
interface Ctx {
  tutorContext: TutorContext | null;
  openTutor: (context: TutorContext) => void;
  id: string;
  job: LessonJob | null;
  loading: boolean;
  balance: number | null;
  refresh: () => Promise<void>;
  markComplete: (index: number, on?: boolean) => void;
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
  const [progressError, setProgressError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [tutorContext, setTutorContext] = useState<TutorContext | null>(null);
  const openTutor = useCallback((context: TutorContext) => {
    setTutorContext(context);
    setChatPrefill(null);
    setChatOpen(true);
  }, []);
  const [chatPrefill, setChatPrefill] = useState<{
    text: string;
    nonce: number;
  } | null>(null);

  const openChat = useCallback((prefill?: string) => {
    setTutorContext(null);
    if (prefill?.trim())
      setChatPrefill({ text: prefill.trim().slice(0, 500), nonce: Date.now() });
    setChatOpen(true);
  }, []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  const load = useCallback(async () => {
    try {
      const { response, data } = await requestJson(`/api/jobs/${id}`);
      if ([401, 403, 404].includes(response.status)) {
        setJob(null);
        return;
      }
      if (!response.ok || typeof data.id !== "string")
        throw new Error(
          "The lesson could not refresh. Your last loaded notes are still available.",
        );
      setJob(data as LessonJob);
      setProgressError("");
    } catch {
      setProgressError(
        "The lesson could not refresh. Check your connection and retry.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (inFlight || !alive) return;
      if (document.hidden) {
        timer = setTimeout(tick, 5000);
        return;
      }
      inFlight = true;
      try {
        const { response: r, data: j } = await requestJson(`/api/jobs/${id}`, {
          signal: controller.signal,
        });
        if (!alive) return;
        if ([401, 403, 404].includes(r.status)) {
          setJob(null);
          setLoading(false);
          return;
        }
        if (!r.ok || typeof j.id !== "string")
          throw new Error("Lesson unavailable");
        setJob(j as LessonJob);
        setProgressError("");
        setLoading(false);
        if (j.status === "working" || j.status === "queued")
          timer = setTimeout(tick, 2200);
      } catch {
        if (alive) {
          setProgressError(
            "Your lesson could not load. Check your connection and retry.",
          );
          timer = setTimeout(tick, 5000);
        }
      } finally {
        inFlight = false;
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
      controller.abort();
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
      setProgressError("");
      try {
        const result = await requestJson(`/api/jobs/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "progress",
            completed,
            lastRoom,
            pdfTemplate,
          }),
        });
        if (!result.response.ok)
          throw new Error(
            result.data.error || "Review progress could not be saved.",
          );
      } catch {
        setProgressError(
          "Review progress was not saved. Reload the lesson, then try marking it again.",
        );
      }
    },
    [id],
  );

  const markComplete = useCallback(
    (index: number, on = true) => {
      if (on) touchStudyDay();
      const cur = job;
      if (!cur) return;
      const completed = new Set(cur.progress?.completed ?? []);
      if (on) completed.add(index);
      else completed.delete(index);
      const values = [...completed].sort((a, b) => a - b);
      setJob({
        ...cur,
        progress: { ...(cur.progress ?? { completed: [] }), completed: values },
      });
      void persistProgress(
        values,
        cur.progress?.lastRoom,
        cur.pdfTemplate ?? undefined,
      );
    },
    [job, persistProgress],
  );

  const value = useMemo(
    () => ({
      id,
      job,
      loading,
      balance,
      refresh: load,
      markComplete,
      chatOpen,
      tutorContext,
      openTutor,
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
      chatOpen,
      tutorContext,
      openTutor,
      chatPrefill,
      openChat,
      closeChat,
    ],
  );

  return (
    <LessonCtx.Provider value={value}>
      {progressError && (
        <div role="alert" className="ws-progress-error">
          {progressError}
          <button className="btn light" onClick={() => void load()}>
            Reload lesson
          </button>
        </div>
      )}
      {children}
    </LessonCtx.Provider>
  );
}
