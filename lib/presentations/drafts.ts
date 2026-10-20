import { randomUUID } from "node:crypto";
import {
  mutateRecord,
  record,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
import { chatWithFallback } from "@/lib/ai/router";
import { type DeckTemplate } from "./model";
import { getJob } from "@/lib/jobs/store";
import { getDocument } from "@/lib/documents/store";
import {
  validateStoryboard,
  verifyMetricPlan,
  type Storyboard,
} from "./archetypes";
import { researchLink, publicResearchUrl } from "./research";
import { sourceContext } from "./source-context";
import type { HybridPlan } from "./hybrid/model";
import { validateHybridPlan } from "./hybrid/pipeline";
export interface DeckSource {
  id: string;
  name: string;
  kind: "lesson" | "document" | "text" | "web";
  text: string;
  locator?: string;
  retrievedAt?: string;
  truncated?: boolean;
  pageSpans?: Array<{ pageNumber: number; start: number; end: number }>;
}
export interface DeckDraft extends WorkspaceRecord {
  kind: "presentation-draft";
  prompt: string;
  language: string;
  template: DeckTemplate;
  count: number;
  outline: string[];
  sources: DeckSource[];
  audience: string;
  format: "detailed" | "presenter";
  revision: number;
  designEngine?: 2 | 3;
  hybridPlan?: HybridPlan;
  storyboard?: Storyboard;
}
export async function ownedSources(
  owner: string,
  input: any[],
  budget = 18000,
  focus = "",
): Promise<DeckSource[]> {
  if (
    process.env.DATA_BACKEND !== "mongo" &&
    !process.env.MONGODB_URI &&
    process.env.APP_ROLE !== "backend" &&
    process.env.APP_ROLE !== "frontend" &&
    process.env.APP_ROLE !== "worker" &&
    process.env.VERCEL !== "1"
  ) {
    const { db } = await import("@/lib/db");
    db()
      .prepare(
        "DELETE FROM workspace_records WHERE kind='presentation-source' AND updated_at < ?",
      )
      .run(new Date(Date.now() - 86400000).toISOString());
  }
  if (!Array.isArray(input) || input.length > 6)
    throw new Error("Use up to six sources.");
  const sources: DeckSource[] = [];
  let remaining = budget;
  for (const ref of input) {
    if (!ref || typeof ref !== "object") throw new Error("Invalid source.");
    let source: DeckSource;
    if (ref.kind === "lesson") {
      const job = await getJob(String(ref.id || ""));
      if (!job || job.user !== owner)
        throw new Error("Source lesson not found.");
      source = {
        id: `lesson-${job.id}`,
        name: job.title || job.topics[0],
        kind: "lesson",
        text: job.pages
          .map((p, i) => `Section ${i + 1}: ${p.topic}\n${p.markdown}`)
          .join("\n"),
        locator: `/lesson/${job.id}/notes`,
      };
    } else if (ref.kind === "document") {
      const doc = await getDocument(owner, String(ref.id || ""));
      if (!doc) throw new Error("Source document not found.");
      const pages =
        budget >= 1200000 && doc.originalPages
          ? doc.originalPages
          : doc.chunks.map((c) => ({ num: c.page, text: c.text }));
      let text = "";
      const pageSpans: NonNullable<DeckSource["pageSpans"]> = [];
      for (const page of pages) {
        text += `[page ${page.num}]\n`;
        const start = text.length;
        text += page.text;
        pageSpans.push({ pageNumber: page.num, start, end: text.length });
        text += "\n\n";
      }
      source = {
        id: `document-${doc.id}`,
        name: doc.name,
        kind: "document",
        text,
        pageSpans,
        locator: `/api/documents/${doc.id}?page=1`,
      };
    } else if (ref.kind === "web") {
      const url = publicResearchUrl(String(ref.url || ref.locator || "")).href;
      const { createHash } = await import("node:crypto");
      const key = `web-source-${createHash("sha256")
        .update(owner + ":" + url)
        .digest("hex")}`;
      const cached = await record<WorkspaceRecord & { source: DeckSource }>(
        key,
      );
      if (
        cached?.owner === owner &&
        cached.kind === "presentation-source" &&
        Date.now() - Date.parse(cached.updatedAt) < 600000
      )
        source = cached.source;
      else {
        source = await researchLink(url);
        const resolved = source;
        await mutateRecord<WorkspaceRecord & { source: DeckSource }>(
          key,
          () => ({
            id: key,
            owner,
            kind: "presentation-source",
            source: resolved,
            updatedAt: new Date().toISOString(),
          }),
        );
      }
    } else if (ref.kind === "text" && typeof ref.text === "string") {
      source = {
        id:
          typeof ref.id === "string" && /^text-[-\w]{8,80}$/.test(ref.id)
            ? ref.id
            : `text-${sources.length + 1}`,
        name: String(ref.name || "Supplied reference text").slice(0, 100),
        kind: "text",
        text: ref.text.slice(0, 250000),
        truncated: ref.text.length > 250000,
      };
    } else throw new Error("Choose an owned source or supply text.");
    if (sources.some((s) => s.id === source.id)) continue;
    const limit = Math.min(
      remaining,
      Math.floor(budget / Math.max(1, input.length)),
    );
    if (budget >= 1200000) {
      if (source.truncated || source.text.length > remaining)
        throw new Error(
          "Source exceeds the full-context budget. Split it before importing; no text was silently discarded.",
        );
      remaining -= source.text.length;
      if (source.text.trim()) sources.push(source);
      continue;
    }
    // Rank across the full owned extraction before creating the bounded snapshot.
    // Prefix clipping here used to discard relevant later pages permanently.
    source = sourceContext([source], focus.slice(0, 3000), limit)[0];
    remaining -= source.text.length;
    if (source.text.trim()) sources.push(source);
  }
  return sources;
}
export async function planDeck(
  owner: string,
  input: Omit<
    DeckDraft,
    | "id"
    | "owner"
    | "kind"
    | "updatedAt"
    | "revision"
    | "outline"
    | "storyboard"
  >,
  id = randomUUID(),
  generate: (
    messages: import("@/lib/ai/router").ChatMsg[],
    opts: { maxTokens: number },
  ) => Promise<{ text: string; provider: string }> = chatWithFallback,
): Promise<DeckDraft> {
  void owner;
  void input;
  void id;
  void generate;
  throw new Error(
    "Legacy planning is retired. Use the asynchronous source-backed planning endpoint.",
  );
}
export async function approveDraft(
  owner: string,
  id: string,
  revision: number,
  outline: unknown,
  settings?: {
    template?: DeckTemplate;
    storyboard?: Storyboard;
    hybridPlan?: HybridPlan;
  },
) {
  if (
    !Array.isArray(outline) ||
    outline.some((t) => typeof t !== "string" || !t.trim() || t.length > 110)
  )
    throw new Error("Every slide needs a title under 110 characters.");
  return mutateRecord<DeckDraft>(id, (old) => {
    if (!old || old.kind !== "presentation-draft" || old.owner !== owner)
      throw new Error("Outline not found.");
    if (
      old.revision === revision + 1 &&
      JSON.stringify(old.outline) === JSON.stringify(outline) &&
      (!settings?.template || settings.template === old.template) &&
      (!settings?.storyboard ||
        JSON.stringify(old.storyboard) ===
          JSON.stringify(settings.storyboard)) &&
      (!settings?.hybridPlan ||
        JSON.stringify(old.hybridPlan) === JSON.stringify(settings.hybridPlan))
    )
      return old;
    if (old.revision !== revision)
      throw new Error("Outline changed. Reopen it before generating.");
    if (outline.length !== old.count)
      throw new Error("Keep the approved slide count.");
    let storyboard = old.storyboard;
    let hybridPlan = old.hybridPlan;
    if (old.designEngine === 3) {
      hybridPlan = validateHybridPlan(
        {
          ...old.hybridPlan,
          genome: settings?.hybridPlan?.genome || old.hybridPlan!.genome,
          beats: (settings?.hybridPlan?.beats || old.hybridPlan!.beats).map(
            (b, i) => ({ ...b, title: outline[i] }),
          ),
        },
        old.sources,
        old.count,
      );
    }
    if (old.designEngine === 2) {
      storyboard = validateStoryboard(
        settings?.storyboard || {
          ...old.storyboard,
          beats: old.storyboard!.beats.map((b, i) => ({
            ...b,
            title: outline[i],
          })),
        },
        old.count,
      );
      for (const beat of storyboard.beats) verifyMetricPlan(beat, old.sources);
      if (
        JSON.stringify(storyboard.beats.map((b) => b.title)) !==
          JSON.stringify(outline) ||
        storyboard.beats.some((b) =>
          b.evidence.some((id) => !old.sources.some((s) => s.id === id)),
        )
      )
        throw new Error(
          "Storyboard and approved outline must match supplied sources.",
        );
    }
    return {
      ...old,
      outline,
      ...(storyboard ? { storyboard } : {}),
      ...(hybridPlan ? { hybridPlan } : {}),
      ...(settings?.template ? { template: settings.template } : {}),
      revision: old.revision + 1,
      updatedAt: new Date().toISOString(),
    };
  });
}
export async function ownedDraft(owner: string, id: string) {
  const d = await record<DeckDraft>(id);
  return d?.kind === "presentation-draft" && d.owner === owner ? d : null;
}
