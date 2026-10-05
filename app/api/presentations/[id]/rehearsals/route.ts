import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { ownedDeck } from "@/lib/presentations/store";
import { readState, mutateState } from "@/lib/study/state";
type Rehearsal = { id: string; seconds: number; slides: number; at: string };
type Context = { params: Promise<{ id: string }> };
export const GET = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!,
    id = (await ctx.params).id;
  if (!(await ownedDeck(user.id, id)))
    return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  return NextResponse.json({
    rehearsals: await readState<Rehearsal[]>(
      user.id,
      `deck-rehearsal:${id}`,
      [],
    ),
  });
});
export const POST = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "deck-rehearsal", 10, 60000));
  if (denied) return denied;
  const user = (await currentUser(req))!,
    id = (await ctx.params).id,
    deck = await ownedDeck(user.id, id);
  if (deck?.status !== "done")
    return NextResponse.json(
      { error: "Completed deck not found." },
      { status: 404 },
    );
  const b = await req.json().catch(() => ({}));
  if (
    !Number.isInteger(b.seconds) ||
    b.seconds < 1 ||
    b.seconds > 7200 ||
    !/^[-\w]{10,80}$/.test(b.event || "")
  )
    return NextResponse.json(
      { error: "Save a rehearsal of 1 second to 2 hours." },
      { status: 400 },
    );
  const rehearsals = await mutateState<Rehearsal[]>(
    user.id,
    `deck-rehearsal:${id}`,
    [],
    (s) =>
      s.some((r) => r.id === b.event)
        ? s
        : [
            {
              id: b.event,
              seconds: b.seconds,
              slides: deck.slides.length,
              at: new Date().toISOString(),
            },
            ...s,
          ].slice(0, 20),
  );
  return NextResponse.json({ rehearsals });
});
