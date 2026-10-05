import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import {
  sharedDeck,
  deckShares,
  addDeckComment,
} from "@/lib/presentations/operations";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
    const denied = await rateLimit(req, "deck-public-view", 60, 60000);
    if (denied) return denied;
    const deck = await sharedDeck((await ctx.params).token);
    return NextResponse.json(
      deck
        ? {
            comments: (await deckShares(deck.id)).comments.map(
              ({ user, ...c }) => {
                void user;
                return c;
              },
            ),
            deck: {
              title: deck.title,
              template: deck.template,
              brand: deck.brand,
              slides: deck.slides.map(({ notes, ...slide }) => {
                void notes;
                return { ...slide, notes: "" };
              }),
            },
          }
        : { error: "Share expired or revoked." },
      { status: deck ? 200 : 404 },
    );
  },
);
export const POST = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
    const denied =
      (await authError(req)) ||
      (await rateLimit(req, "deck-comment", 20, 60000));
    if (denied) return denied;
    const deck = await sharedDeck((await ctx.params).token);
    if (!deck)
      return NextResponse.json(
        { error: "Share expired or revoked." },
        { status: 404 },
      );
    const b = await req.json().catch(() => ({}));
    try {
      await addDeckComment(
        deck,
        (await currentUser(req))!,
        String(b.slide || ""),
        String(b.text || ""),
        String(b.event || ""),
      );
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not post comment." },
        { status: 400 },
      );
    }
  },
);
