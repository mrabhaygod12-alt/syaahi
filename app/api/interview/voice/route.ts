import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import {
  saveVoiceSession,
  voiceSessions,
  VoiceSessionError,
} from "@/lib/interview/voice";
export const GET = apiHandler(async (req: Request) => {
  const denied = await authError(req);
  if (denied) return denied;
  return NextResponse.json({
    sessions: (await voiceSessions((await currentUser(req))!.id)).map(
      ({ id, role, createdAt, report, turns }) => ({
        id,
        role,
        createdAt,
        reviewed: !!report,
        turns: turns.length,
      }),
    ),
  });
});
export const POST = apiHandler(async (req: Request) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "voice-save", 12, 60000));
  if (denied) return denied;
  try {
    const session = await saveVoiceSession(
      (await currentUser(req))!.id,
      await req.json(),
    );
    return NextResponse.json({ id: session.id });
  } catch (error) {
    if (
      !(error instanceof VoiceSessionError) &&
      !(error instanceof SyntaxError)
    )
      throw error;
    return NextResponse.json(
      {
        error:
          error instanceof SyntaxError
            ? "Invalid request body."
            : error.message,
      },
      { status: 400 },
    );
  }
});
