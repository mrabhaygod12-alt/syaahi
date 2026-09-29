import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { guideEngagement, setGuideReaction, tipGuideCreator } from "@/lib/writing/engagement";

async function handleGET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try { return NextResponse.json(await guideEngagement((await params).slug)); }
  catch { return NextResponse.json({ error: "Guide unavailable." }, { status: 404 }); }
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const denied = (await authError(req)) || (await rateLimit(req, "guide-engagement", 20, 60_000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const user = (await currentUser(req))!.id, slug = (await params).slug;
    if ((body.action === "upvote" || body.action === "bookmark") && typeof body.value === "boolean")
      return NextResponse.json(await setGuideReaction(user, slug, body.action, body.value));
    if (body.action === "tip")
      return NextResponse.json(await tipGuideCreator(user, slug, Number(body.credits)));
    return NextResponse.json({ error: "Unsupported guide action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Guide action failed." }, { status: 400 });
  }
}
export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
