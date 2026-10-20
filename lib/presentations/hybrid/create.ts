import { randomUUID } from "node:crypto";
import { balance } from "@/lib/credits/store";
import { presentationLimit } from "@/lib/billing/subscriptions";
import { mutateRecord, record } from "@/lib/workspace-records";
import { ownedSources, type DeckDraft } from "../drafts";
import { researchDossier } from "./research";
import { planHybrid, type HybridGenerate } from "./pipeline";
import { hybridCredits, type DesignGenome } from "./model";
import { writingImage } from "@/lib/writing/images";
export async function createHybridDraft(
  owner: string,
  input: {
    prompt: string;
    count: number;
    audience?: string;
    language: string;
    sources: unknown[];
    liveResearch?: boolean;
    genome?: DesignGenome;
    template?: string;
  },
  generate?: HybridGenerate,
  id: string = randomUUID(),
) {
  const previous = await record<DeckDraft>(id);
  if (previous) {
    if (previous.owner !== owner || previous.designEngine !== 3)
      throw new Error("Draft not available.");
    return previous;
  }
  if (
    typeof input.prompt !== "string" ||
    input.prompt.trim().length < 12 ||
    input.prompt.length > 3000 ||
    !Number.isInteger(input.count) ||
    input.count < 5 ||
    input.count > 30
  )
    throw new Error(
      "Describe your presentation in 12–3000 characters and choose 5–30 slides.",
    );
  const refs = Array.isArray(input.sources) ? [...input.sources] : [];
  const links = input.prompt.match(/https:\/\/[^\s<>"')]+/g) || [];
  for (const url of links.slice(0, 6))
    if (
      !refs.some(
        (s: any) => s.kind === "web" && (s.url === url || s.locator === url),
      )
    )
      refs.push({ kind: "web", url });
  if (
    input.genome?.logoId &&
    (await writingImage(input.genome.logoId))?.owner !== owner
  )
    throw new Error("Brand logo not found in your account.");
  const imported = await ownedSources(owner, refs, 1200000, input.prompt);
  const { sources, trace } = await researchDossier(
    input.prompt,
    imported,
    input.liveResearch === true,
  );
  const plan = await planHybrid(
    {
      ...input,
      audience: String(input.audience || "University learners").slice(0, 120),
      sources,
      research: trace,
      planCap: await presentationLimit(owner),
      balance: await balance(owner),
    },
    generate,
  );
  return mutateRecord<DeckDraft>(id, () => ({
    id,
    owner,
    kind: "presentation-draft",
    prompt: input.prompt.trim(),
    language: input.language,
    audience: String(input.audience || "University learners").slice(0, 120),
    format: "presenter",
    template: "technical",
    count: plan.budget.allocated,
    sources,
    outline: plan.beats.map((b) => b.title),
    designEngine: 3,
    hybridPlan: plan,
    revision: 0,
    updatedAt: new Date().toISOString(),
  }));
}
export function quoteCost(count: number) {
  return { count, credits: hybridCredits(count) };
}
