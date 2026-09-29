import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { reportPublicStory, type ReportReason } from "@/lib/writing/stories";

async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "content-report", 5, 60 * 60_000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const report = await reportPublicStory(
      (await currentUser(req))!.id,
      typeof body.slug === "string" ? body.slug : "",
      typeof body.reason === "string" ? (body.reason as ReportReason) : "other",
      typeof body.details === "string" ? body.details : "",
    );
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not submit report.",
      },
      { status: 400 },
    );
  }
}

export const POST = apiHandler(handlePOST);
