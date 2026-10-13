import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { researchTopic, wikipediaReferences } from "@/lib/research";

export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "presentation-research", 8, 60000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 4 || query.length > 160)
    return NextResponse.json(
      { error: "Enter a research question in 4–160 characters." },
      { status: 400 },
    );
  const found = await researchTopic(query);
  const safe = new Set(wikipediaReferences(found).map((s) => s.url));
  return NextResponse.json({
    provider: "Wikipedia",
    sources: found
      .filter((s) => safe.has(s.url))
      .slice(0, 4)
      .map((s) => ({ ...s, excerpt: s.excerpt.slice(0, 1200) })),
    note: "Discovery uses Wikipedia. Review the originals and import selected articles; no source is added automatically.",
  });
});
