import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { presentationLimit } from "@/lib/billing/subscriptions";
import {
  createDeck,
  isDeckTemplate,
  safeDeck,
  type Deck,
} from "@/lib/presentations/store";
import { records } from "@/lib/workspace-records";
import { normalizeLang } from "@/lib/ai/prompts";
import { kickWorker } from "@/lib/jobs/worker";
import { eligibleProviders } from "@/lib/ai/providers";
import {
  planDeck,
  ownedDraft,
  approveDraft,
  ownedSources,
  type DeckDraft,
} from "@/lib/presentations/drafts";
import { ownedDeck } from "@/lib/presentations/store";
export const runtime = "nodejs";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  const owner = (await currentUser(req))!.id;
  kickWorker();
  const [decks, drafts] = await Promise.all([
    records<Deck>("presentation", owner),
    records<DeckDraft>("presentation-draft", owner),
  ]);
  const generated = new Set(decks.map((d) => d.id));
  return NextResponse.json({
    decks: decks.map(safeDeck),
    drafts: drafts
      .filter((d) => !generated.has(`deck-${d.id}`))
      .map((d) => ({
        id: d.id,
        title: d.outline[0],
        count: d.count,
        template: d.template,
        updatedAt: d.updatedAt,
        designEngine: d.designEngine || 1,
      })),
    maxSlides: await presentationLimit(owner),
    cost: 5,
  });
});
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "presentation-create", 4, 60000));
  if (denied) return denied;
  if (!eligibleProviders().length)
    return NextResponse.json(
      {
        error:
          "Presentation generation is unavailable. Please contact support.",
      },
      { status: 503 },
    );
  const owner = (await currentUser(req))!.id,
    body = await req.json().catch(() => ({})),
    count = Number(body.count),
    max = await presentationLimit(owner);
  if (typeof body.draftId === "string") {
    const id = `deck-${body.draftId}`;
    const existing = await ownedDeck(owner, id);
    if (existing)
      return NextResponse.json({ deck: safeDeck(existing), reused: true });
    const old = await ownedDraft(owner, body.draftId);
    if (!old || old.count > max)
      return NextResponse.json(
        { error: "Outline not found or plan limit changed." },
        { status: 409 },
      );
    try {
      if (body.confirmCredits !== true)
        throw new Error("Approve the five-credit charge before generating.");
      const draft = await approveDraft(
        owner,
        old.id,
        body.revision,
        body.outline,
      );
      const deck = await createDeck(
        owner,
        {
          prompt: `${draft.prompt}\nAudience: ${draft.audience}; format: ${draft.format}`,
          context: draft.sources
            .map((s) => `SOURCE ${s.id}: ${s.name}\n${s.text}`)
            .join("\n")
            .slice(0, 18000),
          language: draft.language,
          template: draft.template,
          count: draft.count,
          outline: draft.outline,
          sources: draft.sources,
          ...(draft.designEngine === 2
            ? { designEngine: 2, storyboard: draft.storyboard }
            : {}),
        },
        id,
      );
      kickWorker();
      return NextResponse.json({ deck: safeDeck(deck) }, { status: 201 });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not start." },
        { status: 409 },
      );
    }
  }
  if (
    typeof body.prompt !== "string" ||
    body.prompt.trim().length < 20 ||
    body.prompt.length > 3000 ||
    !Number.isInteger(count) ||
    count < 4 ||
    count > max ||
    !isDeckTemplate(body.template)
  )
    return NextResponse.json(
      {
        error: `Describe your presentation in 20–3000 characters and select 4–${max} slides.`,
      },
      { status: 400 },
    );
  try {
    if (body.action !== "outline")
      throw new Error(
        "Prepare and approve an outline before generating a deck.",
      );
    const requested = Array.isArray(body.sources) ? [...body.sources] : [];
    if (body.designEngine === 2) {
      const links = body.prompt.match(/https:\/\/[^\s<>"'\)]+/g) || [];
      for (const url of links.slice(0, 6))
        if (
          !requested.some(
            (s) => s.kind === "web" && (s.url === url || s.locator === url),
          )
        )
          requested.push({ kind: "web", url });
    }
    const sources = await ownedSources(
      owner,
      requested,
      body.designEngine === 2 ? 48000 : 18000,
    );
    const draft = await planDeck(owner, {
      prompt: body.prompt.trim(),
      sources,
      audience: String(body.audience || "Students").slice(0, 120),
      format: body.format === "presenter" ? "presenter" : "detailed",
      count,
      template: body.template,
      language: normalizeLang(body.language),
      ...(body.designEngine === 2 ? { designEngine: 2 as const } : {}),
    });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Presentation could not start.",
      },
      { status: 409 },
    );
  }
});
