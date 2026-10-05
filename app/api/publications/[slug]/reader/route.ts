import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { readerState, readerAction } from "@/lib/writing/social";
type Context = { params: Promise<{ slug: string }> };
export const GET = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied = await authError(req);
  if (denied) return denied;
  try {
    return NextResponse.json({
      reader: await readerState(
        (await currentUser(req))!.id,
        (await ctx.params).slug,
      ),
    });
  } catch {
    return NextResponse.json({ error: "Story unavailable." }, { status: 404 });
  }
});
export const POST = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "story-reader", 60, 60000));
  if (denied) return denied;
  try {
    return NextResponse.json({
      reader: await readerAction(
        (await currentUser(req))!.id,
        (await ctx.params).slug,
        await req.json(),
      ),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save reading." },
      { status: 400 },
    );
  }
});
