import { randomUUID } from "node:crypto";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
import {
  mutateRecord,
  record,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
import { chatWithFallback, type ChatMsg } from "@/lib/ai/router";
import { DECK_CREDITS } from "@/lib/billing/subscription-plans";
import {
  DECK_TEMPLATES,
  validateSlide,
  type DeckSlide,
  type DeckTemplate,
  type BrandKit,
} from "./model";
import type { DeckSource } from "./drafts";
import { writingImage } from "@/lib/writing/images";
import type { Storyboard } from "./archetypes";
import { verifyGrounding } from "./archetypes";
import { deckFormat, type DeckFormat } from "./format";
import type { HybridPlan, QualityReport } from "./hybrid/model";
export interface Deck extends WorkspaceRecord {
  format?: DeckFormat;
  designEngine?: 2 | 3;
  hybridPlan?: HybridPlan;
  quality?: QualityReport;
  creditsReserved?: number;
  storyboard?: Storyboard;
  kind: "presentation";
  title: string;
  prompt: string;
  context: string;
  language: string;
  template: DeckTemplate;
  count: number;
  outline: string[];
  slides: DeckSlide[];
  status: "queued" | "working" | "done" | "error";
  attempt: number;
  lease: string | null;
  leaseUntil: number;
  provider: string | null;
  providerRetries?: number;
  error: string | null;
  createdAt: string;
  sources?: DeckSource[];
  brand?: BrandKit;
  history?: Array<{
    id: string;
    at: string;
    label: string;
    slides: DeckSlide[];
    template: DeckTemplate;
    brand?: BrandKit;
  }>;
  stage?: string;
  regenerationEvents?: string[];
}
export async function createDeck(
  owner: string,
  input: {
    prompt: string;
    context: string;
    language: string;
    template: DeckTemplate;
    count: number;
    outline?: string[];
    sources?: DeckSource[];
    designEngine?: 2 | 3;
    hybridPlan?: HybridPlan;
    creditsReserved?: number;
    storyboard?: Storyboard;
    format?: DeckFormat;
  },
  id: string = randomUUID(),
) {
  if (input.designEngine !== 3)
    throw new Error(
      "Legacy creation has been retired. Create a source-backed plan.",
    );
  const existing = await ownedDeck(owner, id);
  if (existing) return existing;
  if (input.designEngine === 3) {
    const { validateHybridPlan } = await import("./hybrid/pipeline");
    const { hybridCredits } = await import("./hybrid/model");
    input.hybridPlan = validateHybridPlan(
      input.hybridPlan,
      input.sources || [],
      input.count,
    );
    input.creditsReserved = hybridCredits(input.count);
    if (
      JSON.stringify(input.outline) !==
      JSON.stringify(input.hybridPlan.beats.map((b) => b.title))
    )
      throw new Error("The approved source-backed outline changed.");
  }
  const pending = useMongo()
    ? await (
        await collection("workspace_records")
      ).countDocuments(
        {
          kind: "presentation",
          owner,
          "payload.status": { $in: ["queued", "working"] },
        },
        { limit: 3 },
      )
    : Number(
        db()
          .prepare(
            "SELECT COUNT(*) AS count FROM workspace_records WHERE kind='presentation' AND owner=? AND json_extract(payload,'$.status') IN ('queued','working')",
          )
          .get(owner)?.count || 0,
      );
  if (pending >= 3)
    throw new Error(
      "Finish or retry your pending decks before starting another.",
    );
  const now = new Date().toISOString();
  return mutateRecord<Deck>(
    id,
    (old) => {
      if (old) {
        if (old.owner !== owner || old.kind !== "presentation")
          throw new Error("This request already exists.");
        return old;
      }
      return {
        id,
        owner,
        kind: "presentation",
        title: input.prompt.slice(0, 100),
        ...input,
        format: deckFormat(input.format),
        outline: input.outline || [],
        sources: input.sources || [],
        slides: [],
        status: "queued",
        attempt: 1,
        lease: null,
        leaseUntil: 0,
        provider: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      };
    },
    { delta: -(input.creditsReserved ?? DECK_CREDITS), event: `deck:${id}:1` },
  );
}
export async function ownedDeck(owner: string, id: string) {
  const deck = await record<Deck>(id);
  return deck?.kind === "presentation" && deck.owner === owner ? deck : null;
}
export async function retryDeck(owner: string, id: string) {
  const deck = await ownedDeck(owner, id);
  if (!deck) throw new Error("Presentation not found.");
  if (deck.designEngine !== 3)
    throw new Error(
      "Create a new source-backed plan. Legacy generation is retired.",
    );
  return mutateRecord<Deck>(
    id,
    (old) => {
      if (
        !old ||
        old.owner !== owner ||
        old.status !== "error" ||
        old.attempt !== deck.attempt
      )
        throw new Error("Only a failed presentation can be retried.");
      return {
        ...old,
        status: "queued",
        error: null,
        attempt: old.attempt + 1,
        providerRetries: 0,
        lease: null,
        leaseUntil: 0,
        updatedAt: new Date().toISOString(),
      };
    },
    {
      delta: -(deck.creditsReserved ?? DECK_CREDITS),
      event: `deck:${id}:${deck.attempt + 1}`,
    },
  );
}
export async function editDeck(
  owner: string,
  id: string,
  slides: unknown,
  expectedUpdatedAt: string,
  maxSlides = 15,
  confirmCredits = false,
) {
  if (!Array.isArray(slides)) throw new Error("Provide slides.");
  let next: DeckSlide[] = slides
    .map(validateSlide)
    .map((s) => ({ ...s, id: s.id || randomUUID() }));
  if (new Set(next.map((s) => s.id)).size !== next.length)
    throw new Error("Slide IDs must be unique.");
  const imageIds = new Set(
    next
      .flatMap((s) => [
        s.imageId,
        ...(s.objects || [])
          .filter((o) => o.type === "image")
          .map((o) => o.imageId),
      ])
      .filter((v): v is string => !!v),
  );
  for (const imageId of imageIds)
    if ((await writingImage(imageId))?.owner !== owner)
      throw new Error("Image not found in your account.");
  const original = await ownedDeck(owner, id);
  const reserve =
    original?.designEngine === 3 && original.status === "error"
      ? (original.creditsReserved ?? DECK_CREDITS)
      : 0;
  if (reserve > 0 && !confirmCredits)
    throw new Error(
      `Approve the ${reserve}-credit retry reservation before applying these edits.`,
    );
  if (original?.designEngine === 3) {
    if (next.some((s) => !s.manifest))
      throw new Error(
        "Every new-engine slide requires a source-backed manifest.",
      );
    const { manifestSlide } = await import("./hybrid/pipeline");
    const { ownedScene } = await import("./hybrid/scene-assets");
    for (const slide of next)
      if (
        slide.manifest!.visual.splineAssetId &&
        !(await ownedScene(owner, slide.manifest!.visual.splineAssetId!))
      )
        throw new Error("Spline scene not found in your account.");
    next = next.map((s) => manifestSlide(s.manifest!, original.sources || []));
    if (new Set(next.map((s) => s.id)).size !== next.length)
      throw new Error("Scene manifest IDs must be unique.");
    const { verifyFacts } = await import("./hybrid/grounding");
    verifyFacts(
      next.map((s) => s.manifest!),
      original.sources || [],
    );
    for (const s of next)
      if (
        s.manifest?.genome.logoId &&
        (await writingImage(s.manifest.genome.logoId))?.owner !== owner
      )
        throw new Error("Brand logo not found.");
  }
  return mutateRecord<Deck>(
    id,
    (old) => {
      if (
        !old ||
        old.owner !== owner ||
        !["done", "error"].includes(old.status) ||
        old.updatedAt !== expectedUpdatedAt ||
        next.length < 1 ||
        next.length > Math.max(old.count, maxSlides)
      )
        throw new Error("Presentation changed. Reopen it before editing.");
      if (old.designEngine === 3 && next.length !== old.count)
        throw new Error(
          "Scene count is tied to the approved reservation. Create a new plan to change it.",
        );
      if (
        next.some((s) =>
          (s.evidence || []).some(
            (source) => !old.sources?.some((ref) => ref.id === source),
          ),
        )
      )
        throw new Error(
          "Evidence must refer to a source imported into this deck.",
        );
      for (const s of next)
        if (s.semantic) verifyGrounding(s.semantic, old.sources || []);
      return {
        ...old,
        title: next[0].title,
        slides: next,
        count: next.length,
        outline: next.map((s) => s.title),
        ...(old.designEngine === 3
          ? {
              status: "queued" as const,
              quality: undefined,
              creditsReserved: reserve,
              attempt: reserve > 0 ? old.attempt + 1 : old.attempt,
              stage: "Rechecking your edited scenes",
              lease: null,
              leaseUntil: 0,
            }
          : {}),
        history: [
          {
            id: randomUUID(),
            at: old.updatedAt,
            label: "Before edit",
            slides: old.slides,
            template: old.template,
            ...(old.brand ? { brand: old.brand } : {}),
          },
          ...(old.history || []),
        ].slice(0, 12),
        updatedAt: new Date(
          Math.max(Date.now(), Date.parse(old.updatedAt) + 1),
        ).toISOString(),
      };
    },
    reserve > 0
      ? { delta: -reserve, event: `deck:${id}:${original!.attempt + 1}` }
      : undefined,
  );
}
type Generate = (
  messages: ChatMsg[],
  opts: { maxTokens: number },
) => Promise<{ text: string; provider: string }>;
export async function processDeck(
  id: string,
  generate: Generate = chatWithFallback,
) {
  if ((await record<Deck>(id))?.designEngine === 3) {
    await (await import("./hybrid/worker")).processHybridDeck(id);
    return;
  }
  void generate;
  const old = await record<Deck>(id);
  if (
    !old ||
    old.kind !== "presentation" ||
    !["queued", "working"].includes(old.status) ||
    old.leaseUntil > Date.now()
  )
    return;
  // Retire unfinished old-engine jobs without deleting any saved scene.
  await mutateRecord<Deck>(
    id,
    (current) => {
      if (
        !current ||
        current.owner !== old.owner ||
        !["queued", "working"].includes(current.status) ||
        current.leaseUntil > Date.now()
      )
        throw new Error("Job changed.");
      return {
        ...current,
        status: "error",
        lease: null,
        leaseUntil: 0,
        stage: "Legacy generation retired",
        error:
          "This engine has been retired. Saved scenes remain readable and exportable; reserved credits were returned. Create a new source-backed brief.",
        updatedAt: new Date().toISOString(),
      };
    },
    {
      delta: old.creditsReserved || DECK_CREDITS,
      event: `deck-refund:${id}:${old.attempt}`,
    },
  );
}
export async function pendingDeck(): Promise<Deck | null> {
  // Filter before limiting; a dashboard's recent-record limit must not hide
  // an older unfinished job behind completed presentations.
  const now = Date.now();
  if (useMongo()) {
    const row = await (
      await collection("workspace_records")
    ).findOne(
      {
        kind: "presentation",
        "payload.status": { $in: ["queued", "working"] },
        "payload.leaseUntil": { $lte: now },
      },
      { sort: { "payload.createdAt": 1 } },
    );
    return (row?.payload as Deck) || null;
  }
  const row = db()
    .prepare(
      "SELECT payload FROM workspace_records WHERE kind='presentation' AND json_extract(payload,'$.status') IN ('queued','working') AND json_extract(payload,'$.leaseUntil')<=? ORDER BY json_extract(payload,'$.createdAt') ASC LIMIT 1",
    )
    .get(now);
  return row ? JSON.parse(String(row.payload)) : null;
}
export async function processPendingDeck() {
  const deck = await pendingDeck();
  if (deck) await processDeck(deck.id);
  else await (await import("./operations")).pendingSlide();
}
export function safeDeck(deck: Deck) {
  const { lease, context, prompt, ...publicData } = deck;
  void lease;
  void context;
  void prompt;
  return publicData;
}
export const isDeckTemplate = (v: unknown): v is DeckTemplate =>
  typeof v === "string" && Object.hasOwn(DECK_TEMPLATES, v);
