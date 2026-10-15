import { listOwnedVideos } from "@/lib/youtube/jobs";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import {
  enqueueVideo,
  videoProjection,
  VideoQueueError,
} from "@/lib/youtube/jobs";
import { kickWorker } from "@/lib/jobs/worker";
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "youtube", 3, 60000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const { url } = await req.json().catch(() => ({}));
  if (typeof url !== "string" || url.length > 2048)
    return NextResponse.json(
      { error: "Provide a valid YouTube URL." },
      { status: 400 },
    );
  let job;
  try {
    job = await enqueueVideo(user.id, url);
  } catch (error) {
    if (error instanceof VideoQueueError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    throw error;
  }
  kickWorker();
  return NextResponse.json(videoProjection(job), {
    status: job.status === "done" ? 200 : 202,
  });
});

export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  const jobs = await listOwnedVideos((await currentUser(req))!.id);
  if (
    jobs.some((job) => ["queued", "reading", "assessing"].includes(job.status))
  )
    kickWorker();
  return NextResponse.json({ jobs });
});
