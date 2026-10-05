import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { publicResponses, respond, removeResponse } from "@/lib/writing/social";
type Context = { params: Promise<{ slug: string }> };
export const GET = apiHandler(async (req: NextRequest, ctx: Context) => {
  try {
    return NextResponse.json({
      responses: await publicResponses(
        (await ctx.params).slug,
        (await currentUser(req))?.id,
      ),
    });
  } catch {
    return NextResponse.json({ error: "Story unavailable." }, { status: 404 });
  }
});
export const POST = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "story-response", 10, 60000));
  if (denied) return denied;
  try {
    const b = await req.json(),
      user = (await currentUser(req))!,
      slug = (await ctx.params).slug;
    if (b.action === "delete")
      await removeResponse(user.id, slug, String(b.id || ""));
    else
      await respond(
        user.id,
        user.name,
        slug,
        String(b.body || ""),
        String(b.event || ""),
      );
    return NextResponse.json({
      responses: await publicResponses(slug, user.id),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Response failed." },
      { status: 400 },
    );
  }
});
