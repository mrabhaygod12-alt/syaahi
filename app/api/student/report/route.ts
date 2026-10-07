import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { getJob } from "@/lib/jobs/store";
import { changeTicket, listTickets, type SupportTicket } from "@/lib/support";
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "note-error", 4, 60000));
  if (denied) return denied;
  const user = (await currentUser(req))!,
    b = await req.json().catch(() => null);
  if (
    typeof b?.lesson !== "string" ||
    b.lesson.length > 100 ||
    typeof b?.detail !== "string" ||
    b.detail.trim().length < 20 ||
    b.detail.length > 3000
  )
    return NextResponse.json(
      { error: "Describe the issue in 20–3,000 characters." },
      { status: 400 },
    );
  const job = await getJob(b.lesson);
  if (!job || job.user !== user.id)
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  if (
    (await listTickets(user.id)).filter(
      (t) => !["closed", "resolved"].includes(t.status),
    ).length >= 10
  )
    return NextResponse.json(
      { error: "Reply to an existing support ticket before opening another." },
      { status: 409 },
    );
  const id = randomUUID(),
    createdAt = new Date().toISOString(),
    subject = ("Check lesson: " + (job.title || job.topics[0])).slice(0, 120);
  const ticket = {
    id,
    user: user.id,
    subject,
    category: "generation",
    status: "open" as const,
    createdAt,
    workspace: "student" as const,
    messages: [
      {
        by: "learner" as const,
        text: `Lesson ${job.id}\n${b.detail.trim()}`,
        at: createdAt,
      },
    ],
  };
  await changeTicket(
    user.id,
    id,
    () => ticket as SupportTicket,
    undefined,
    "create",
    true,
  );
  return NextResponse.json({ id }, { status: 201 });
});
