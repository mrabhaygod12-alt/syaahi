import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { followStatus, followWriter } from "@/lib/writing/social";
type Context = { params: Promise<{ slug: string }> };
export const GET = apiHandler(async (req: NextRequest, ctx: Context) => {
  try {
    return NextResponse.json(
      await followStatus((await ctx.params).slug, (await currentUser(req))?.id),
    );
  } catch {
    return NextResponse.json({ error: "Writer unavailable." }, { status: 404 });
  }
});
export const POST = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "writer-follow", 20, 60000));
  if (denied) return denied;
  try {
    const body = await req.json(),
      slug = (await ctx.params).slug,
      owner = (await currentUser(req))!.id;
    if (typeof body.active !== "boolean")
      throw new Error("Choose follow or unfollow.");
    await followWriter(owner, slug, body.active);
    return NextResponse.json(await followStatus(slug, owner));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not follow." },
      { status: 400 },
    );
  }
});
