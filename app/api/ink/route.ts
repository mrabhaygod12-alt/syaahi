import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { inkAccount, inkEntitled } from "@/lib/ink/access";
import { rateLimit } from "@/lib/ratelimit";
import { analyse } from "@/lib/ink/analyse";
import {
  deleteReport,
  getReport,
  listReports,
  reportSummary,
  saveReport,
} from "@/lib/ink/store";
import type { SourceDocument } from "@/lib/ink/match";

export const runtime = "nodejs";
export const maxDuration = 60;

/** How many integrity runs a learner may start per hour. */
const RUNS_PER_HOUR = 12;
/** How many uploaded reference sources a single run may include. */
const MAX_SOURCES = 10;

/**
 * Pull the learner's uploaded reference material. A source that fails to load
 * is dropped rather than failing the whole run, because a partial comparison
 * is still useful and the trace tells the reader what was included.
 */
async function loadSources(
  owner: string,
  ids: string[],
): Promise<SourceDocument[]> {
  const { getDocument } = await import("@/lib/documents/store");
  const out: SourceDocument[] = [];
  for (const id of ids.slice(0, MAX_SOURCES)) {
    try {
      const doc = await getDocument(owner, id);
      if (!doc) throw new Error("An attached source is unavailable. Remove it and retry.");
      const text = (doc.chunks || [])
        .map((c) => c.text)
        .join("\n")
        .slice(0, 60000);
      if (text.trim().length < 200) continue;
      out.push({
        id: `upload-${doc.id}`,
        title: doc.name || "Uploaded source",
        kind: "upload",
        text,
        retrievedAt: new Date().toISOString(),
      });
    } catch {
      throw new Error("An attached source could not be loaded. Remove it and retry.");
    }
  }
  return out;
}

async function handleGET(req: NextRequest) {
  const access = await inkAccount(req, false);
  if (access.response) return access.response;
  const user = access.user!;
  const entitled = await inkEntitled(user);
  if (new URL(req.url).searchParams.has("access"))
    return NextResponse.json({ entitled, searchConfigured: (await import("@/lib/ink/search")).searchConfigured() });
  if (!entitled) return NextResponse.json({ error: "A purchased student plan is required.", code: "INK_PLAN_REQUIRED" }, { status: 402 });
  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    const report = await getReport(user.id, id);
    if (!report)
      return NextResponse.json({ error: "Unknown report." }, { status: 404 });
    return NextResponse.json({ report });
  }

  const reports = await listReports(user.id);
  return NextResponse.json({
    reports: reports.map(reportSummary),
    limits: { runsPerHour: RUNS_PER_HOUR, maxSources: MAX_SOURCES },
  });
}

async function handlePOST(req: NextRequest) {
  const access = await inkAccount(req);
  if (access.response) return access.response;
  const denied = await rateLimit(req, "ink", RUNS_PER_HOUR, 3600000);
  if (denied) return denied;
  const user = access.user!;
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Provide a JSON object." }, { status: 400 });

  const action = String(body.action || "analyse");

  if (action === "analyse") {
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim())
      return NextResponse.json(
        { error: "Paste the text you want checked." },
        { status: 400 },
      );

    const sourceIds: string[] = Array.isArray(body.sourceIds)
      ? body.sourceIds.filter((x: unknown) => typeof x === "string").slice(0, MAX_SOURCES)
      : [];

    try {
      const sources = sourceIds.length ? await loadSources(user.id, sourceIds) : [];
      if (typeof body.referenceText === "string" && body.referenceText.trim()) {
        if (body.referenceText.length > 60000) throw new Error("Keep a pasted reference under 60,000 characters.");
        sources.push({ id: "pasted-reference", title: "Your pasted reference", kind: "upload", text: body.referenceText });
      }
      const analysis = await analyse({
        text,
        sources,
        // Sending unpublished excerpts to search requires an explicit opt-in.
        allowWeb: body.allowWeb === true,
      });
      const report = await saveReport({
        owner: user.id,
        title:
          typeof body.title === "string" && body.title.trim()
            ? body.title
            : "Untitled submission",
        analysis,
        requestId:
          typeof body.requestId === "string" ? body.requestId.slice(0, 80) : undefined,
      });
      return NextResponse.json({ report, summary: reportSummary(report) });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "The check could not be completed.",
        },
        { status: 400 },
      );
    }
  }

  if (action === "delete") {
    const id = String(body.id || "");
    try {
      await deleteReport(user.id, id);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Unknown report." }, { status: 404 });
    }
  }

  return NextResponse.json(
    { error: "action must be 'analyse' or 'delete'." },
    { status: 400 },
  );
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
