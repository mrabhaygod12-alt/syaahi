import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { writerBySlug } from "@/lib/writing/profile";
import { writerConnections, ConnectionError } from "@/lib/writing/connections";
export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const writer = await writerBySlug((await ctx.params).slug);
    if (!writer)
      return NextResponse.json(
        { error: "Writer unavailable." },
        { status: 404 },
      );
    try {
      return NextResponse.json(
        await writerConnections(
          writer.owner,
          req.nextUrl.searchParams.get("mode") || "following",
          req.nextUrl.searchParams.get("cursor") || "",
          (await currentUser(req))?.id,
        ),
      );
    } catch (e) {
      if (!(e instanceof ConnectionError)) throw e;
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
  },
);
