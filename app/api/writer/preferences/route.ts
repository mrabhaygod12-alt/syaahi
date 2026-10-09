import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { writerAccess } from "@/lib/writing/profile";
import { rateLimit } from "@/lib/ratelimit";
import {
  readingPreferences,
  updateReadingPreferences,
  RecommendationError,
} from "@/lib/writing/recommendations";
async function access(req: Request) {
  const user = await currentUser(req);
  if (!user)
    return {
      denied: NextResponse.json(
        { error: "Sign in to your writer account." },
        { status: 401 },
      ),
    };
  const denied = await writerAccess(user.id);
  return denied ? { denied } : { user };
}
export const GET = apiHandler(async (req: NextRequest) => {
  const a = await access(req);
  if (a.denied) return a.denied;
  return NextResponse.json({
    preferences: await readingPreferences(a.user!.id),
  });
});
export const PATCH = apiHandler(async (req: NextRequest) => {
  const a = await access(req);
  if (a.denied) return a.denied;
  const limited = await rateLimit(req, "writer-preferences", 15, 60000);
  if (limited) return limited;
  try {
    return NextResponse.json({
      preferences: await updateReadingPreferences(a.user!.id, await req.json()),
    });
  } catch (e) {
    if (!(e instanceof RecommendationError)) throw e;
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
});
