import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { presentationLimit } from "@/lib/billing/subscriptions";
import { createDeck, safeDeck } from "@/lib/presentations/store";
import { normalizeLang } from "@/lib/ai/prompts";
import { kickWorker } from "@/lib/jobs/worker";
import { eligibleProviders } from "@/lib/ai/providers";
import { ownedDraft, approveDraft } from "@/lib/presentations/drafts";
import { ownedDeck } from "@/lib/presentations/store";
import { queuePlan, publicPlanTask } from "@/lib/presentations/hybrid/tasks";
import { hybridCredits, GENOMES } from "@/lib/presentations/hybrid/model";
import { balance } from "@/lib/credits/store";
import { studioLibrary } from "@/lib/presentations/hybrid/library";
export const runtime = "nodejs";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  const owner = (await currentUser(req))!.id;
  kickWorker();
  const { decks, drafts } = await studioLibrary(owner);
  const generated = new Set(decks.map((d) => d.id));
  return NextResponse.json({
    decks: decks.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      count: d.count,
      updatedAt: d.updatedAt,
      designEngine: d.designEngine || 1,
      template: d.template,
      slides: d.slides.slice(0, 1),
      quality: d.quality,
      stage: d.stage,
    })),
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
    credits: await balance(owner),
    engine: 3,
    genomes: GENOMES,
  });
});
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "presentation-create", 4, 60000));
  if (denied) return denied;
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
    if (old?.designEngine !== 3)
      return NextResponse.json(
        {
          error:
            "This draft uses the retired slide engine. Import its sources into a new studio brief; saved presentations remain available.",
        },
        { status: 409 },
      );
    if (!old || old.count > max)
      return NextResponse.json(
        { error: "Outline not found or plan limit changed." },
        { status: 409 },
      );
    try {
      const cost = hybridCredits(old.count);
      if (body.confirmCredits !== true || body.expectedCredits !== cost)
        throw new Error(
          `Approve the ${cost}-credit reservation before generating.`,
        );
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
          format: draft.format,
          template: draft.template,
          count: draft.count,
          outline: draft.outline,
          sources: draft.sources,
          designEngine: 3,
          hybridPlan: draft.hybridPlan,
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
  if (body.action === "outline") {
    if (!eligibleProviders().length)
      return NextResponse.json(
        {
          error:
            "Presentation generation is unavailable. Please contact support.",
        },
        { status: 503 },
      );

    if (body.designEngine !== undefined && body.designEngine !== 3)
      return NextResponse.json(
        {
          error:
            "The legacy creation engine is retired. Open the new presentation studio.",
        },
        { status: 410 },
      );
    try {
      const task = await queuePlan(owner, body.event, {
        prompt: body.prompt,
        count,
        audience:
          typeof body.audience === "string"
            ? body.audience.slice(0, 120)
            : "University learners",
        language: normalizeLang(body.language),
        sources: Array.isArray(body.sources) ? body.sources : [],
        liveResearch: body.liveResearch === true,
        ...(body.genome ? { genome: body.genome } : {}),
      });
      kickWorker();
      return NextResponse.json({ task: publicPlanTask(task) }, { status: 202 });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Research could not start.",
        },
        { status: 409 },
      );
    }
  }
  return NextResponse.json(
    {
      error:
        "Use the source-backed studio to prepare and approve a storyboard.",
    },
    { status: 410 },
  );
});
