import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { ownedDeck } from "@/lib/presentations/store";
import { rateLimit } from "@/lib/ratelimit";
import { neuralNarration } from "@/lib/presentations/hybrid/services";
export const POST = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const denied =
      (await authError(req)) ||
      (await rateLimit(req, "presentation-narration", 6, 300000));
    if (denied) return denied;
    const owner = (await currentUser(req))!.id,
      deck = await ownedDeck(owner, (await ctx.params).id);
    if (!deck || deck.designEngine !== 3 || deck.status !== "done")
      return NextResponse.json(
        { error: "Choose a completed source-backed presentation." },
        { status: 404 },
      );
    const body = await req.json().catch(() => ({})),
      slide = deck.slides.find((s) => s.id === body.slide)?.manifest;
    if (!slide)
      return NextResponse.json({ error: "Scene not found." }, { status: 404 });
    try {
      return NextResponse.json(await neuralNarration(owner, slide));
    } catch {
      return NextResponse.json(
        {
          error:
            "Neural narration is not ready. Check the configured voice service, or use device voice.",
        },
        { status: 503 },
      );
    }
  },
);
