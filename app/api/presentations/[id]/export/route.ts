import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { ownedDeck } from "@/lib/presentations/store";
import { exportDeck } from "@/lib/presentations/export";
export const runtime = "nodejs";
export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const denied =
      (await authError(req)) ||
      (await rateLimit(req, "presentation-export", 8, 60000));
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
    if (deck.status !== "done")
      return NextResponse.json(
        { error: "Wait for the presentation to finish." },
        { status: 409 },
      );
    const bytes = await exportDeck(deck);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="syaahi-${deck.id}.pptx"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
