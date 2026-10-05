import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import {
  freshHub,
  hubView,
  scheduleExam,
  type HubState,
} from "@/lib/study/hub";
import { mutateState } from "@/lib/study/state";
import { composerDraft } from "@/lib/study/drafts";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "hub-read", 90, 60000));
  if (denied) return denied;
  return NextResponse.json(
    await hubView(
      (await currentUser(req))!.id,
      req.nextUrl.searchParams.get("q") || "",
    ),
  );
});
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "hub-save", 60, 60000));
  if (denied) return denied;
  const owner = (await currentUser(req))!.id,
    b = await req.json().catch(() => ({}));
  try {
    const state = await mutateState<HubState>(owner, "hub", freshHub(), (s) => {
      if (b.action === "draft") {
        if (b.revision !== s.revision)
          throw new Error(
            "Draft changed on another device. Reload before saving.",
          );
        if (
          b.draft !== null &&
          (typeof b.draft !== "object" || Array.isArray(b.draft))
        )
          throw new Error("Invalid draft.");
        if (JSON.stringify(b.draft).length > 240000)
          throw new Error("Draft exceeds the source limit.");
        s.draft = composerDraft(b.draft);
        s.revision++;
        s.updatedAt = new Date().toISOString();
      } else if (b.action === "timezone") {
        const zone = String(b.timezone || "").slice(0, 80);
        new Intl.DateTimeFormat("en", { timeZone: zone });
        s.timezone = zone;
      } else if (b.action === "exam") {
        if (s.exams.length >= 12)
          throw new Error("Keep at most 12 active exam plans.");
        s.exams.push(scheduleExam(b, undefined, s.timezone));
      } else if (b.action === "exam-task") {
        const task = s.exams
          .find((e) => e.id === b.exam)
          ?.tasks.find((t) => t.id === b.task);
        if (!task) throw new Error("Task not found.");
        task.done = b.done === true;
      } else if (b.action === "exam-replan") {
        const index = s.exams.findIndex((e) => e.id === b.exam);
        if (index < 0) throw new Error("Exam not found.");
        s.exams[index] = scheduleExam(b, s.exams[index], s.timezone);
      } else if (b.action === "exam-delete")
        s.exams = s.exams.filter((e) => e.id !== b.exam);
      else throw new Error("Unknown action.");
      return s;
    });
    return NextResponse.json({ state });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save." },
      { status: 409 },
    );
  }
});
