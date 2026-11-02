import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { inkAccount } from "@/lib/ink/access";
import { rateLimit } from "@/lib/ratelimit";
import { getReport } from "@/lib/ink/store";
import { integrityPdf } from "@/lib/ink/pdf";
import { DEFAULT_MATCH_FILTERS, type MatchFilters } from "@/lib/ink/filters";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = apiHandler(async (req: NextRequest) => {
  const access = await inkAccount(req);
  if (access.response) return access.response;
  const denied = await rateLimit(req, "ink-export", 12, 3600000);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || body.id.length > 100)
    return NextResponse.json(
      { error: "Choose a report to export." },
      { status: 400 },
    );
  const report = await getReport(access.user!.id, body.id);
  if (!report)
    return NextResponse.json({ error: "Unknown report." }, { status: 404 });
  const f = body.filters;
  if (
    f !== undefined &&
    (!f ||
      typeof f !== "object" ||
      Array.isArray(f) ||
      typeof f.bibliography !== "boolean" ||
      typeof f.quotes !== "boolean" ||
      !Number.isInteger(f.minWords) ||
      f.minWords < 12 ||
      f.minWords > 100 ||
      !Array.isArray(f.excludedSources) ||
      f.excludedSources.length > 34 ||
      f.excludedSources.some(
        (s: unknown) => typeof s !== "string" || s.length > 150,
      ))
  )
    return NextResponse.json(
      { error: "Invalid similarity filters." },
      { status: 400 },
    );
  const filters: MatchFilters = f
    ? {
        bibliography: f.bibliography,
        quotes: f.quotes,
        minWords: f.minWords,
        excludedSources: f.excludedSources,
      }
    : DEFAULT_MATCH_FILTERS;
  const bytes = await integrityPdf(report, filters);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="ai-ink-integrity-report.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
