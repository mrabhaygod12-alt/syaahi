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
    const deck = await createDeck(owner, {
      prompt: body.prompt.trim(),
      context:
        typeof body.context === "string" ? body.context.slice(0, 18000) : "",
      count,
      template: body.template,
      language: normalizeLang(body.language),
    });
    kickWorker();
    return NextResponse.json({ deck: safeDeck(deck) }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Presentation could not start.",
      },
      { status: 409 },
    );
  }
});
