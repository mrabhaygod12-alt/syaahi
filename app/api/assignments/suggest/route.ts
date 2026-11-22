import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { chatWithFallback } from "@/lib/ai/router";
import {
  ASSIGNMENT_FORMATS,
  MAX_ASSIGNMENT_PAGES,
  validAssignmentFormat,
} from "@/lib/assignments/types";

export const runtime = "nodejs";
export const maxDuration = 45;

export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "assignment-page-suggest", 8, 60_000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  if (user.workspace === "writer")
    return NextResponse.json(
      { error: "Switch to your student workspace to use Assignment Studio." },
      { status: 403 },
    );
  const raw = await req.text();
  if (raw.length > 10_000)
    return NextResponse.json(
      { error: "Assignment brief is too large to suggest a page count." },
      { status: 413 },
    );
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid page suggestion request." },
      { status: 400 },
    );
  }
  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
  const topic =
    typeof body.topic === "string" ? body.topic.trim().slice(0, 800) : "";
  const instructions =
    typeof body.instructions === "string"
      ? body.instructions.trim().slice(0, 7000)
      : "";
  const format = body.format;
  if (
    title.length < 4 ||
    topic.length < 4 ||
    instructions.length < 20 ||
    !validAssignmentFormat(format)
  )
    return NextResponse.json(
      {
        error:
          "Add the assignment title, topic, instructions, and a supported format first.",
      },
      { status: 400 },
    );
  try {
    const result = await chatWithFallback(
      [
        {
          role: "system",
          content: `Return strict JSON only: {"pages":1,"reason":"..."}. Recommend a realistic number of A4 content pages for a university ${format} based on the scope and rubric. Use 180–220 handwritten-style words per page. Do not count the bibliography. Stay within 1–${MAX_ASSIGNMENT_PAGES}; do not inflate the scope. Explain the choice in one short sentence.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            title,
            topic,
            instructions,
            format,
            availableFormats: ASSIGNMENT_FORMATS,
          }),
        },
      ],
      { maxTokens: 220, json: true, timeoutMs: 30_000, maxAttempts: 3 },
    );
    const match = result.text
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .match(/\{[\s\S]*\}/);
    const suggestion = match ? JSON.parse(match[0]) : null;
    const pages = Number(suggestion?.pages);
    if (
      !Number.isSafeInteger(pages) ||
      pages < 1 ||
      pages > MAX_ASSIGNMENT_PAGES
    )
      throw new Error("The page suggestion was incomplete.");
    return NextResponse.json({
      pages,
      reason:
        typeof suggestion.reason === "string"
          ? suggestion.reason.slice(0, 240)
          : "Based on the assignment scope and format.",
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "AI page suggestions are temporarily unavailable. You can still choose the page count yourself.",
      },
      { status: 503, headers: { "Retry-After": "10" } },
    );
  }
});
