import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import {
  queueMedia,
  publicMediaJob,
  kickMedia,
} from "@/lib/presentations/hybrid/media";
import { kickWorker } from "@/lib/jobs/worker";
export const POST = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const denied =
      (await authError(req)) ||
      (await rateLimit(req, "presentation-movie", 6, 3600000));
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    try {
      const job = await queueMedia(
        (await currentUser(req))!.id,
        (await ctx.params).id,
        body.format,
        body.event,
      );
      kickWorker();
      if (process.env.WORKER_MODE !== "external") kickMedia();
      return NextResponse.json({ job: publicMediaJob(job) }, { status: 202 });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not queue export." },
        { status: 409 },
      );
    }
  },
);
