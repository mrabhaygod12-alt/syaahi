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
} from "@/lib/presentations/drafts";
import { ownedDeck } from "@/lib/presentations/store";
export const runtime = "nodejs";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  const owner = (await currentUser(req))!.id;
  kickWorker();
  return NextResponse.json({
    decks: (await records<Deck>("presentation", owner)).map(safeDeck),
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
    const sources = await ownedSources(
      owner,
      Array.isArray(body.sources) ? body.sources : [],
    );
    const draft = await planDeck(owner, {
      prompt: body.prompt.trim(),
      sources,
      audience: String(body.audience || "Students").slice(0, 120),
      format: body.format === "presenter" ? "presenter" : "detailed",
      count,
      template: body.template,
      language: normalizeLang(body.language),
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
