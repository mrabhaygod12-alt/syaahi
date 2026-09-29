import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { rateLimit } from "@/lib/ratelimit";
import { recordPublicStoryView } from "@/lib/writing/stories";

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const denied = await rateLimit(req, "publication-view", 20, 60 * 60_000);
  if (denied) return denied;
  await recordPublicStoryView((await params).slug);
  return NextResponse.json({ ok: true });
}

export const POST = apiHandler(handlePOST);
