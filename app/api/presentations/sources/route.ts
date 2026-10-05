import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { listDocuments } from "@/lib/documents/store";
import { listJobs } from "@/lib/jobs/store";
import { ownedSources } from "@/lib/presentations/drafts";
import { rateLimit } from "@/lib/ratelimit";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  const owner = (await currentUser(req))!.id;
  const [documents, jobs] = await Promise.all([
    listDocuments(owner),
    listJobs(owner, 100),
  ]);
  return NextResponse.json({
    documents,
    lessons: jobs
      .filter((j) => j.pages.length)
      .map((j) => ({ id: j.id, name: j.title || j.topics[0] })),
  });
});
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "deck-sources", 20, 60000));
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({
      sources: await ownedSources(
        (await currentUser(req))!.id,
        b.sources,
        b.designEngine === 2 ? 48000 : 18000,
      ),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Source not available." },
      { status: 400 },
    );
  }
});
