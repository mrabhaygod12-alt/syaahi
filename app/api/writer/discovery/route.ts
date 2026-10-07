import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { writerAccess } from "@/lib/writing/profile";
import { rateLimit } from "@/lib/ratelimit";
import {
  analyzeDiscovery,
  savedDiscovery,
  applyDiscovery,
  DiscoveryError,
} from "@/lib/writing/discovery";
async function access(req: Request) {
  const user = await currentUser(req);
  if (!user)
    return {
      denied: NextResponse.json(
        { error: "Sign in to your writer account." },
        { status: 401 },
      ),
    };
  const denied = await writerAccess(user.id);
  return denied ? { denied } : { user };
}
export const GET = apiHandler(async (req: NextRequest) => {
  const a = await access(req);
  if (a.denied) return a.denied;
  try {
    return NextResponse.json(
      await savedDiscovery(
        a.user!.id,
        req.nextUrl.searchParams.get("storyId") || "",
      ),
    );
  } catch (e) {
    if (!(e instanceof DiscoveryError)) throw e;
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
});
export const POST = apiHandler(async (req: NextRequest) => {
  const a = await access(req);
  if (a.denied) return a.denied;
  const b = await req.json().catch(() => null);
  if (
    typeof b?.storyId !== "string" ||
    b.storyId.length > 80 ||
    typeof b.expectedUpdatedAt !== "string" ||
    b.expectedUpdatedAt.length > 50 ||
    !["analyze", "apply"].includes(b.action)
  )
    return NextResponse.json(
      { error: "Include the saved draft and current revision." },
      { status: 400 },
    );
  const limited = await rateLimit(
    req,
    b.action === "analyze" ? "writer-discovery-ai" : "writer-discovery-apply",
    b.action === "analyze" ? 5 : 20,
    b.action === "analyze" ? 3600000 : 60000,
  );
  if (limited) return limited;
  try {
    if (b.action === "analyze")
      return NextResponse.json({
        report: await analyzeDiscovery(
          a.user!.id,
          b.storyId,
          b.expectedUpdatedAt,
        ),
      });
    if (
      typeof b.reportId !== "string" ||
      b.reportId.length > 100 ||
      typeof b.title !== "string" ||
      b.title.length > 80 ||
      typeof b.description !== "string" ||
      b.description.length > 160 ||
      b.approve !== true
    )
      throw new DiscoveryError(
        "Review the title and description and explicitly approve them first.",
      );
    return NextResponse.json({
      story: await applyDiscovery(
        a.user!.id,
        b.storyId,
        b.expectedUpdatedAt,
        b,
      ),
    });
  } catch (e) {
    if (!(e instanceof DiscoveryError)) throw e;
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
});
