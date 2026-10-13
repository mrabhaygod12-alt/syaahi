import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { followStatus, followWriter, FollowError } from "@/lib/writing/social";
type Context = { params: Promise<{ slug: string }> };
export const GET = apiHandler(async (req: NextRequest, ctx: Context) => {
  try {
    return NextResponse.json(
      await followStatus((await ctx.params).slug, (await currentUser(req))?.id),
    );
  } catch (e) {
    if (!(e instanceof FollowError)) throw e;
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
});
export const POST = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "writer-follow", 20, 60000));
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => {
        throw new FollowError("Provide valid follow information.");
      }),
      slug = (await ctx.params).slug,
      owner = (await currentUser(req))!.id;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.active !== "boolean"
    )
      throw new FollowError("Choose follow or unfollow.");
    await followWriter(owner, slug, body.active);
    return NextResponse.json(await followStatus(slug, owner));
  } catch (e) {
    if (!(e instanceof FollowError)) throw e;
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
});
