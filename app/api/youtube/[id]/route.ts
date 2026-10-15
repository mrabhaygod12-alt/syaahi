import { cancelVideo } from "@/lib/youtube/jobs";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { ownedVideo, videoProjection } from "@/lib/youtube/jobs";
import { kickWorker } from "@/lib/jobs/worker";
export const GET = apiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const denied = await authError(req);
    if (denied) return denied;
    const job = await ownedVideo(
      (await params).id,
      (await currentUser(req))!.id,
    );
    if (!job)
      return NextResponse.json(
        { error: "Video processing job not found." },
        { status: 404 },
      );
    if (["queued", "reading", "assessing"].includes(job.status)) kickWorker();
    return NextResponse.json(videoProjection(job));
  },
);

export const POST = apiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const denied = await authError(req);
    if (denied) return denied;
    const body = await req.json().catch(() => null);
    if (body?.action !== "cancel")
      return NextResponse.json(
        { error: "Choose a supported processing action." },
        { status: 400 },
      );
    const job = await cancelVideo(
      (await params).id,
      (await currentUser(req))!.id,
    );
    if (!job)
      return NextResponse.json(
        { error: "Video job not found." },
        { status: 404 },
      );
    return NextResponse.json(videoProjection(job));
  },
);
