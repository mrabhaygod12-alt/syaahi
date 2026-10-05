import { randomUUID, createHash } from "node:crypto";
import { listJobs } from "@/lib/jobs/store";
import { readState, mutateState } from "./state";
export interface ExamPlan {
  id: string;
  name: string;
  date: string;
  minutes: number;
  tasks: Array<{ id: string; topic: string; done: boolean; date: string }>;
}
export interface HubState {
  revision: number;
  timezone: string;
  days: string[];
  events: string[];
  exams: ExamPlan[];
  draft: Record<string, unknown> | null;
  updatedAt: string;
}
export const freshHub = (): HubState => ({
  revision: 0,
  timezone: "Asia/Kolkata",
  days: [],
  events: [],
  exams: [],
  draft: null,
  updatedAt: "",
});
export const stableCardId = (card: { front: string; back: string }) =>
  createHash("sha256")
    .update(card.front + "\n" + card.back)
    .digest("hex")
    .slice(0, 20);
export function dayAt(at: number, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
export async function studyActivity(owner: string, event: string) {
  return mutateState(owner, "hub", freshHub(), (s) => {
    if (s.events.includes(event)) return s;
    const today = dayAt(Date.now(), s.timezone);
    s.events = [event, ...s.events].slice(0, 1000);
    s.days = [...new Set([today, ...s.days])].sort().slice(-370);
    return s;
  });
}
export function streakFor(days: string[], timezone: string, at = Date.now()) {
  const today = dayAt(at, timezone),
    yesterday = dayAt(at - 86400000, timezone);
  let cursor = days.includes(today) ? today : yesterday,
    streak = 0;
  while (days.includes(cursor)) {
    streak++;
    cursor = new Date(Date.parse(cursor + "T12:00:00Z") - 86400000)
      .toISOString()
      .slice(0, 10);
  }
  return streak;
}
export function scheduleExam(
  input: any,
  old?: ExamPlan,
  timezone = "Asia/Kolkata",
): ExamPlan {
  const name = String(input.name || old?.name || "")
      .trim()
      .slice(0, 100),
    date = String(input.date || old?.date || "");
  const minutes = Number(input.minutes || old?.minutes || 30);
  if (
    !name ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date ||
    date < dayAt(Date.now(), timezone) ||
    date > dayAt(Date.now() + 730 * 86400000, timezone) ||
    !Number.isInteger(minutes) ||
    minutes < 10 ||
    minutes > 480
  )
    throw new Error("Choose a future date and 10–480 study minutes per day.");
  const topics = old
    ? old.tasks
        .filter((t) => !t.done)
        .map((t) => ({ id: t.id, topic: t.topic }))
    : String(input.topics || "")
        .split(/\n/)
        .map((topic: string) => ({
          id: randomUUID(),
          topic: topic.trim().slice(0, 160),
        }))
        .filter((t: any) => t.topic)
        .slice(0, 120);
  if (!topics.length && !old)
    throw new Error("Add at least one topic, one per line.");
  const now = dayAt(Date.now(), timezone),
    start = Date.parse(now + "T12:00Z");
  const days = Math.max(
    1,
    Math.round((Date.parse(date + "T12:00Z") - start) / 86400000),
  );
  const tasks = topics.map((t: any, i: number) => ({
    ...t,
    done: false,
    date: new Date(
      start +
        Math.min(
          days - 1,
          Math.floor((i * days) / Math.max(1, topics.length)),
        ) *
          86400000,
    )
      .toISOString()
      .slice(0, 10),
  }));
  return {
    id: old?.id || randomUUID(),
    name,
    date,
    minutes,
    tasks: [...(old?.tasks.filter((t) => t.done) || []), ...tasks],
  };
}
export async function hubView(owner: string, query = "") {
  const [state, learning, jobs] = await Promise.all([
    readState(owner, "hub", freshHub()),
    readState<any>(owner, "learning", { reviews: {}, attempts: [] }),
    listJobs(owner, 100),
  ]);
  const due = jobs
    .filter((j) => j.status === "done")
    .flatMap((j) =>
      (j.practice?.flashcards || []).map((c, index) => ({
        lesson: j.id,
        title: j.title || j.topics[0],
        index,
        id: stableCardId(c),
        front: c.front,
        back: c.back,
        due: learning.reviews?.[j.id]?.[stableCardId(c)]?.due || 0,
      })),
    )
    .filter((c) => c.due <= Date.now())
    .sort((a, b) => a.due - b.due);
  const ongoing = jobs
    .filter(
      (j) => j.pages.length && (j.progress?.completed.length || 0) < j.total,
    )
    .sort(
      (a, b) =>
        Date.parse(b.progress?.visitedAt || b.createdAt) -
          Date.parse(a.progress?.visitedAt || a.createdAt) ||
        ((b.progress?.completed.length || 0) > 0 ? 1 : 0) -
          ((a.progress?.completed.length || 0) > 0 ? 1 : 0),
    )[0];
  const attempts = learning.attempts || [],
    weak = attempts.flatMap((a: any) => a.weak || []);
  const counts = new Map<string, number>();
  for (const text of weak) counts.set(text, (counts.get(text) || 0) + 1);
  const normalized = query.trim().toLocaleLowerCase().slice(0, 100);
  const results =
    normalized.length < 2
      ? []
      : jobs
          .flatMap((j) => [
            ...j.pages.map((p, i) => ({
              lesson: j.id,
              room: "notes",
              section: i,
              title: p.topic,
              text: p.markdown,
            })),
            ...(j.context
              ? [
                  {
                    lesson: j.id,
                    room: "source",
                    section: 0,
                    title: j.sourceName || "Source",
                    text: j.context,
                  },
                ]
              : []),
            ...(j.practice?.flashcards || []).map((c, i) => ({
              lesson: j.id,
              room: "flashcards",
              section: i,
              title: c.front,
              text: c.front + " · " + c.back,
            })),
          ])
          .filter(
            (p) =>
              p.text.toLocaleLowerCase().includes(normalized) ||
              p.title.toLocaleLowerCase().includes(normalized),
          )
          .slice(0, 30)
          .map((p) => {
            const at = Math.max(
              0,
              p.text.toLocaleLowerCase().indexOf(normalized) - 50,
            );
            return {
              ...p,
              text: undefined,
              snippet: p.text.slice(at, at + 220),
            };
          });
  return {
    owner,
    state,
    due: due.slice(0, 200),
    dueCount: due.length,
    streak: streakFor(state.days, state.timezone),
    continue: ongoing
      ? {
          id: ongoing.id,
          title: ongoing.title || ongoing.topics[0],
          room: ["notes", "learn", "quiz", "flashcards", "source"].includes(
            ongoing.progress?.lastRoom || "",
          )
            ? ongoing.progress!.lastRoom
            : "learn",
          completed: ongoing.progress?.completed.length || 0,
          total: ongoing.total,
        }
      : null,
    weak: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, evidence]) => ({ topic, evidence })),
    attempts: attempts.slice(0, 20),
    results,
  };
}
