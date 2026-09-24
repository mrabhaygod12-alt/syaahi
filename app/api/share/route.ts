import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { resolveShare } from "@/lib/study/collaboration";
import { getJob } from "@/lib/jobs/store";
import { rateLimit } from "@/lib/ratelimit";
async function handlePOST(req: Request) {
  const limited = await rateLimit(req, "public-share", 60, 60000);
  if (limited) return limited;
  const b = await req.json().catch(() => ({}));
  const share = await resolveShare(String(b.token || ""));
  const job = share ? await getJob(share.lesson) : null;
  if (!job)
    return NextResponse.json(
      { error: "This share link is unavailable or has been revoked." },
      { status: 404 },
    );
  return NextResponse.json(
    {
      title: job.title || job.topics[0],
      pages: job.pages.map((p) => ({ topic: p.topic, markdown: p.markdown })),
      role: share!.link.role,
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}

export const POST = apiHandler(handlePOST);
