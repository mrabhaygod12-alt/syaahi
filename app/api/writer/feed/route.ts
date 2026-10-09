import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { writerAccess } from "@/lib/writing/profile";
import { rateLimit } from "@/lib/ratelimit";
import { recommendedStories } from "@/lib/writing/recommendations";
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await currentUser(req);
  if (!user)
    return NextResponse.json(
      { error: "Sign in to your writer account." },
      { status: 401 },
    );
  const denied =
    (await writerAccess(user.id)) ||
    (await rateLimit(req, "writer-feed", 60, 60000));
  if (denied) return denied;
  const mode = req.nextUrl.searchParams.get("mode") || "for_you";
  if (!["for_you", "latest", "following"].includes(mode))
    return NextResponse.json(
      { error: "Choose For you, Latest or Following." },
      { status: 400 },
    );
  return NextResponse.json(
    await recommendedStories(
      user.id,
      mode as "for_you" | "latest" | "following",
    ),
  );
});
