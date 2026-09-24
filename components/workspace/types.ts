export interface JobPage {
  topic: string;
  markdown: string;
  provider: string;
  model: string;
}
export interface QuizQ {
  q: string;
  type: string;
  options?: string[];
  answer: string;
  hint?: string;
  topic?: string;
  explanation?: string;
}
export interface LessonJob {
  revision?: number;
  accessRole?: "owner" | "editor" | "viewer";
  id: string;
  topics: string[];
  style: string;
  status: string;
  pages: JobPage[];
  total: number;
  plannedTotal?: number;
  planNote?: string | null;
  context: string | null;
  brief: string | null;
  sourceUrl: string | null;
  sourceKind?: string | null;
  sourceName?: string | null;
  title: string | null;
  practice: {
    quiz: QuizQ[];
    flashcards: Array<{ front: string; back: string }>;
  } | null;
  error: string | null;
  createdAt: string;
  shortage: { have: number; need: number } | null;
  progress: { completed: number[]; lastRoom?: string } | null;
  language?: string | null;
  pdfTemplate?: string | null;
  podcastScript?: string | null;
  creditsSpent?: number;
}

export const ROOMS = [
  { id: "notes", label: "Notes", href: "notes" },
  { id: "quiz", label: "Quiz", href: "quiz" },
  { id: "learn", label: "Lesson", href: "learn" },
  { id: "flashcards", label: "Flashcards", href: "flashcards" },
  { id: "podcast", label: "Podcast", href: "podcast" },
  { id: "share", label: "Share & discuss", href: "share" },
  { id: "source", label: "Source", href: "source" },
] as const;

export type RoomId = (typeof ROOMS)[number]["id"];

export function lessonTitle(job: LessonJob) {
  return (
    job.title ??
    (job.topics.length > 1
      ? `${job.topics[0]} +${job.topics.length - 1} more`
      : (job.topics[0] ?? "Lesson"))
  );
}

export function ytId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,20})/,
  );
  return m?.[1] ?? null;
}

export function contentsModel(job: LessonJob) {
  const n = Math.max(job.topics.length, job.plannedTotal ?? job.total, 1);
  const items: Array<{
    kind: "section" | "checkpoint" | "final";
    index: number;
    title: string;
    pages: number;
  }> = [];
  let seq = 1;
  job.topics.forEach((t, i) => {
    items.push({ kind: "section", index: i, title: t, pages: 1 });
    seq++;
    if ((i + 1) % 5 === 0 && i < job.topics.length - 1) {
      items.push({
        kind: "checkpoint",
        index: i,
        title: "Checkpoint",
        pages: 0,
      });
    }
  });
  items.push({ kind: "final", index: n, title: "Final Quiz", pages: 0 });
  void seq;
  return items;
}
