import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import {
  ownedDeck,
  retryDeck,
  editDeck,
  safeDeck,
} from "@/lib/presentations/store";
import { kickWorker } from "@/lib/jobs/worker";
import { rateLimit } from "@/lib/ratelimit";
import { presentationLimit } from "@/lib/billing/subscriptions";
import {
  duplicateDeck,
  restoreDeck,
  applyBrand,
  queueSlide,
  deckShares,
  createDeckShare,
  revokeDeckShare,
  addDeckComment,
  deleteDeckComment,
} from "@/lib/presentations/operations";
import { records } from "@/lib/workspace-records";
type Context = { params: Promise<{ id: string }> };
export const GET = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied = await authError(req);
  if (denied) return denied;
  const deck = await ownedDeck(
    (await currentUser(req))!.id,
    (await ctx.params).id,
  );
  if (!deck)
    return NextResponse.json(
      { error: "Presentation not found." },
      { status: 404 },
    );
  kickWorker();
  return NextResponse.json({
    deck: safeDeck(deck),
    maxSlides: await presentationLimit(deck.owner),
    regenerations: (await records<any>("deck-regeneration", deck.owner))
      .filter((r) => r.deck === deck.id)
      .slice(0, 5)
      .map(({ id, slide, status, error }) => ({ id, slide, status, error })),
    shares: (await deckShares(deck.id)).links.map(({ id, expires }) => ({
      id,
      expires,
    })),
    comments: (await deckShares(deck.id)).comments.map(({ user, ...c }) => {
      void user;
      return c;
    }),
  });
});
export const PATCH = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "presentation-edit", 12, 60000));
  if (denied) return denied;
  const owner = (await currentUser(req))!.id,
    id = (await ctx.params).id,
    body = await req.json().catch(() => ({}));
  try {
    if (body.action === "comment") {
      const deck = await ownedDeck(owner, id);
      if (!deck) throw new Error("Deck not found.");
      await addDeckComment(
        deck,
        (await currentUser(req))!,
        body.slide,
        String(body.text || ""),
        String(body.event || ""),
      );
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete-comment") {
      await deleteDeckComment(owner, id, String(body.comment || ""));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "regenerate") {
      if (body.confirmCredits !== true)
        throw new Error("Approve the one-credit slide regeneration cost.");
      const task = await queueSlide(
        owner,
        id,
        body.slide,
        String(body.instruction || ""),
        String(body.event || ""),
      );
      kickWorker();
      return NextResponse.json({ task: { id: task.id, status: task.status } });
    }
    if (body.action === "share")
      return NextResponse.json({ share: await createDeckShare(owner, id) });
    if (body.action === "revoke-share") {
      await revokeDeckShare(owner, id, body.share);
      return NextResponse.json({ ok: true });
    }
    const deck =
      body.action === "retry"
        ? await retryDeck(owner, id)
        : body.action === "duplicate"
          ? await duplicateDeck(owner, id)
          : body.action === "restore"
            ? await restoreDeck(
                owner,
                id,
                body.version,
                body.expectedUpdatedAt,
                await presentationLimit(owner),
              )
            : body.action === "brand"
              ? await applyBrand(owner, id, body.brand, body.expectedUpdatedAt)
              : await editDeck(
                  owner,
                  id,
                  body.slides,
                  body.expectedUpdatedAt,
                  await presentationLimit(owner),
                );
    kickWorker();
    return NextResponse.json({ deck: safeDeck(deck) });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Presentation could not update.",
      },
      { status: 409 },
    );
  }
});
