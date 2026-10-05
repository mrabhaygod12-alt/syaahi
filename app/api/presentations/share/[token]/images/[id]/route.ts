import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { sharedDeck } from "@/lib/presentations/operations";
import { writingImage } from "@/lib/writing/images";
import { rateLimit } from "@/lib/ratelimit";
export const GET = apiHandler(
  async (
    req: NextRequest,
    ctx: { params: Promise<{ token: string; id: string }> },
  ) => {
    const denied = await rateLimit(req, "deck-share-image", 60, 60000);
    if (denied) return denied;
    const { token, id } = await ctx.params,
      deck = await sharedDeck(token);
    if (
      !deck?.slides.some(
        (s) =>
          s.imageId === id ||
          s.objects?.some((o) => o.type === "image" && o.imageId === id),
      )
    )
      return new NextResponse(null, { status: 404 });
    const image = await writingImage(id);
    if (!image || image.owner !== deck.owner)
      return new NextResponse(null, { status: 404 });
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);
