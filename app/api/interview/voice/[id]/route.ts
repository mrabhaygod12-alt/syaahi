import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import {
  voiceSession,
  deleteVoiceSession,
  publicSession,
  claimVoiceReview,
  finishVoiceReview,
  VoiceSessionError,
} from "@/lib/interview/voice";
import { reviewVoiceSession } from "@/lib/interview/voice-report";
type Context = { params: Promise<{ id: string }> };
export const maxDuration = 120;
export const GET = apiHandler(async (req: Request, ctx: Context) => {
  const denied = await authError(req);
  if (denied) return denied;
  const session = await voiceSession(
    (await currentUser(req))!.id,
    (await ctx.params).id,
  );
  return session
    ? NextResponse.json({ session: publicSession(session) })
    : NextResponse.json({ error: "Voice session not found." }, { status: 404 });
});
export const DELETE = apiHandler(async (req: Request, ctx: Context) => {
  const denied = await authError(req);
  if (denied) return denied;
  await deleteVoiceSession((await currentUser(req))!.id, (await ctx.params).id);
  return NextResponse.json({ deleted: true });
});
export const POST = apiHandler(async (req: Request, ctx: Context) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "voice-coaching", 4, 3600000));
  if (denied) return denied;
  const owner = (await currentUser(req))!.id,
    id = (await ctx.params).id;
  if (!(await voiceSession(owner, id)))
    return NextResponse.json(
      { error: "Voice session not found." },
      { status: 404 },
    );
  let claim;
  try {
    claim = await claimVoiceReview(owner, id);
  } catch (error) {
    if (!(error instanceof VoiceSessionError)) throw error;
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (claim.session.report)
    return NextResponse.json({ session: publicSession(claim.session) });
  try {
    const report = await reviewVoiceSession(claim.session);
    const saved = await finishVoiceReview(owner, id, claim.token, report);
    return saved
      ? NextResponse.json({ session: publicSession(saved) })
      : NextResponse.json({ error: "Session was deleted." }, { status: 404 });
  } catch {
    await finishVoiceReview(owner, id, claim.token);
    return NextResponse.json(
      {
        error:
          "Coaching is temporarily unavailable. Your transcript is saved; please retry later.",
      },
      { status: 503 },
    );
  }
});
