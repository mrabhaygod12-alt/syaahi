import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { ownedDeck } from "@/lib/presentations/store";
import { exportDeck } from "@/lib/presentations/export";
import { visualExport } from "@/lib/presentations/visual-export";
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
    const format = req.nextUrl.searchParams.get("format") || "pptx";
    if (!["pptx", "pdf", "png", "notes"].includes(format))
      return NextResponse.json(
        { error: "Choose PPTX, PDF, notes PDF or a slide image." },
        { status: 400 },
      );
    const bytes =
      format === "pptx"
        ? await exportDeck(deck)
        : await visualExport(
            deck,
            format as "pdf" | "png" | "notes",
            Number(req.nextUrl.searchParams.get("slide") || 0),
          );
    const extension =
      format === "pptx" ? "pptx" : format === "png" ? "png" : "pdf";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          format === "pptx"
            ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            : format === "png"
              ? "image/png"
              : "application/pdf",
        "Content-Disposition": `attachment; filename="syaahi-${deck.id}.${extension}"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
