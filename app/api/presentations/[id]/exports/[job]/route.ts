import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { mediaDownload, cancelMedia } from "@/lib/presentations/hybrid/media";
type Context = { params: Promise<{ id: string; job: string }> };
export const GET = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied = await authError(req);
  if (denied) return denied;
  const { id, job } = await ctx.params,
    file = await mediaDownload((await currentUser(req))!.id, id, job);
  if (!file)
    return NextResponse.json(
      { error: "Export unavailable or expired." },
      { status: 404 },
    );
  return new Response(Readable.toWeb(file.stream) as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(file.job.bytes),
      "Content-Disposition": `attachment; filename="syaahi-${id}-${file.job.format}.mp4"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
export const DELETE = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied = await authError(req);
  if (denied) return denied;
  const { id, job } = await ctx.params;
  try {
    await cancelMedia((await currentUser(req))!.id, id, job);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Pending export not found." },
      { status: 404 },
    );
  }
});
