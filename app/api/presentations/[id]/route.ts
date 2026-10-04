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
  return NextResponse.json({ deck: safeDeck(deck) });
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
    const deck =
      body.action === "retry"
        ? await retryDeck(owner, id)
        : await editDeck(owner, id, body.slides, body.expectedUpdatedAt);
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
