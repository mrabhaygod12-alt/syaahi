import { createHash, randomUUID } from "node:crypto";
import { assertQueryString } from "@/lib/security/validation";
import {
  mutateRecord,
  record,
  records,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
import type { InkAnalysis } from "./analyse";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";

/**
 * Persistence for integrity snapshots. A report is immutable after creation —
 * re-analysing the same text produces a new snapshot rather than editing the
 * old one, because the whole point is a record of what was true at a moment.
 */

export interface InkReport extends WorkspaceRecord, InkAnalysis {
  title: string;
  createdAt: string;
}

export interface SaveInput {
  owner: string;
  title: string;
  analysis: InkAnalysis;
  /** Optional client-supplied id so a retried request cannot duplicate a report. */
  requestId?: string;
}

export function reportId(owner: string, requestId?: string): string {
  if (!requestId) return `ink-report-${randomUUID()}`;
  const digest = createHash("sha256")
    .update(`${owner}\n${requestId}`)
    .digest("hex")
    .slice(0, 32);
  return `ink-report-${digest}`;
}

export async function saveReport(input: SaveInput): Promise<InkReport> {
  const id = reportId(input.owner, input.requestId);
  const now = new Date().toISOString();
  return mutateRecord<InkReport>(id, (old) => {
    // Idempotent replay: the first snapshot wins.
    if (old) return old;
    return {
      ...input.analysis,
      id,
      owner: input.owner,
      kind: "ink-report",
      updatedAt: now,
      createdAt: now,
      title: input.title.slice(0, 160) || "Untitled submission",
    };
  });
}

export async function getReport(
  owner: string,
  id: string,
): Promise<InkReport | null> {
  assertQueryString(id);
  const found = await record<InkReport>(id);
  if (!found || found.kind !== "ink-report") return null;
  if (found.owner !== owner) return null;
  return found;
}

export async function listReports(owner: string): Promise<InkReport[]> {
  assertQueryString(owner);
  const all = await records<InkReport>("ink-report", owner);
  return all
    .filter((r) => r.kind === "ink-report")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function deleteReport(owner: string, id: string): Promise<void> {
  const found = await getReport(owner, id);
  if (!found) throw new Error("Unknown report.");
  if (useMongo()) await (await collection("workspace_records")).deleteOne({ _id: id, owner, kind: "ink-report" });
  else db().prepare("DELETE FROM workspace_records WHERE id=? AND owner=? AND kind='ink-report'").run(id, owner);
}

/** Header payload for list views — never ships the full submission text. */
export function reportSummary(report: InkReport) {
  return {
    id: report.id,
    title: report.title,
    words: report.words,
    footprint: report.style.footprint,
    band: report.style.band,
    matched: Math.round(report.match.coverage * 100),
    sources: report.match.sourceCount,
    citations: report.citations.score,
    createdAt: report.createdAt,
    search: report.search.status,
  };
}
