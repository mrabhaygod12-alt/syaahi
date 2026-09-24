import { apiHandler } from "@/lib/api-handler";
import { accessRole } from "@/lib/study/collaboration";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { getJob } from "@/lib/jobs/store";
import { mutateState, readState } from "@/lib/study/state";
import { rateLimit } from "@/lib/ratelimit";
interface Folder {
  id: string;
  name: string;
  lessons: string[];
}
interface CardReview {
  due: number;
  interval: number;
  repetitions: number;
  lastEvent: string;
}
interface Study {
  folders: Folder[];
  reviews: Record<string, Record<string, CardReview>>;
  attempts: Array<{
    lesson: string;
    correct: number;
    total: number;
    at: string;
    weak: string[];
  }>;
}
const fresh = (): Study => ({ folders: [], reviews: {}, attempts: [] });
const cardId = (f: { front: string; back: string }) =>
  createHash("sha256")
    .update(f.front + "\n" + f.back)
    .digest("hex")
    .slice(0, 20);
async function handleGET(req: Request) {
  const denied = await authError(req);
  if (denied) return denied;
  return NextResponse.json(
    await readState((await currentUser(req))!.id, "learning", fresh()),
    { headers: { "Cache-Control": "no-store" } },
  );
}
async function handlePOST(req: Request) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "study", 90, 60000));
  if (denied) return denied;
  const user = (await currentUser(req))!.id;
  const b = await req.json().catch(() => ({}));
  const lesson = typeof b.lesson === "string" ? await getJob(b.lesson) : null;
  if (b.lesson && (!lesson || !(await accessRole(lesson, user))))
    return NextResponse.json({ error: "Unknown lesson." }, { status: 404 });
  try {
    const next = await mutateState(user, "learning", fresh(), (s) => {
      if (b.action === "folder") {
        const name = String(b.name || "")
          .trim()
          .slice(0, 60);
        if (!name || s.folders.length >= 50)
          throw new Error("Use a folder name; maximum 50 folders.");
        s.folders.push({ id: randomUUID(), name, lessons: [] });
      } else if (b.action === "assign") {
        const folder = s.folders.find((f) => f.id === b.folder);
        if (!folder || !lesson) throw new Error("Choose a folder and lesson.");
        for (const f of s.folders)
          f.lessons = f.lessons.filter((id) => id !== lesson.id);
        folder.lessons.push(lesson.id);
      } else if (b.action === "delete-folder") {
        s.folders = s.folders.filter((f) => f.id !== b.folder);
      } else if (b.action === "review") {
        if (
          !lesson?.practice?.flashcards?.[b.index] ||
          !["again", "hard", "good", "easy"].includes(b.rating) ||
          !/^[-\w]{10,80}$/.test(String(b.event || ""))
        )
          throw new Error("Choose a saved card and a review rating.");
        const id = cardId(lesson.practice.flashcards[b.index]);
        const reviews = s.reviews[lesson.id] || {};
        const old = reviews[id] || {
          due: 0,
          interval: 0,
          repetitions: 0,
          lastEvent: "",
        };
        if (old.lastEvent === b.event) return s;
        const interval =
          b.rating === "again"
            ? 0
            : b.rating === "hard"
              ? Math.max(1, Math.round(old.interval * 1.2))
              : b.rating === "easy"
                ? Math.max(3, Math.round(old.interval * 3.2))
                : Math.max(1, Math.round(old.interval * 2.5));
        reviews[id] = {
          due: Date.now() + (interval ? interval * 86400000 : 600000),
          interval,
          repetitions: old.repetitions + 1,
          lastEvent: b.event,
        };
        s.reviews[lesson.id] = reviews;
      } else if (b.action === "quiz-attempt") {
        if (
          !lesson?.practice?.quiz ||
          !Array.isArray(b.answers) ||
          b.answers.length !== lesson.practice.quiz.length
        )
          throw new Error("Submit answers for the saved quiz.");
        const qs = lesson.practice.quiz;
        if (
          b.questions &&
          JSON.stringify(b.questions) !== JSON.stringify(qs.map((q) => q.q))
        )
          throw new Error(
            "This quiz was rebuilt. Reload it before saving a result.",
          );
        const correct = qs.filter((q, i) => q.answer === b.answers[i]).length;
        const weak = qs
          .filter((q, i) => q.answer !== b.answers[i])
          .map((q) => (q as any).topic || q.q);
        s.attempts = [
          {
            lesson: lesson.id,
            correct,
            total: qs.length,
            at: new Date().toISOString(),
            weak,
          },
          ...s.attempts,
        ].slice(0, 100);
      } else throw new Error("Unknown study action.");
      return s;
    });
    return NextResponse.json(next);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Could not save study progress.",
      },
      { status: 400 },
    );
  }
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
