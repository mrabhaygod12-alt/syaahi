import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { writingImage } from "@/lib/writing/images";
import { researchLink, publicPage } from "@/lib/presentations/research";
import {
  DEFAULT_GENOME,
  contrast,
  validateGenome,
} from "@/lib/presentations/hybrid/model";
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "presentation-genome", 6, 60000));
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  try {
    let colors: string[] = [],
      origin = "logo palette";
    if (typeof b.imageId === "string") {
      const image = await writingImage(b.imageId);
      if (!image || image.owner !== (await currentUser(req))!.id)
        throw new Error("Choose an owned brand image.");
      const stats = await sharp(image.bytes, { limitInputPixels: 24000000 })
        .resize(64, 64, { fit: "inside" })
        .stats();
      const d = stats.dominant;
      colors = [
        "#" +
          [d.r, d.g, d.b].map((n) => n.toString(16).padStart(2, "0")).join(""),
      ];
    } else if (typeof b.url === "string") {
      await researchLink(b.url);
      const page = await publicPage(b.url, 1000000);
      colors = [...new Set(page.body.match(/#[a-f0-9]{6}\b/gi) || [])].slice(
        0,
        12,
      );
      origin = "website CSS palette";
    } else throw new Error("Upload a logo or provide a public brand URL.");
    const accent = colors[0] || DEFAULT_GENOME.accent,
      canvas =
        colors.find((c) => contrast(c, "#ffffff") >= 7) ||
        DEFAULT_GENOME.canvas;
    const ink = contrast(canvas, "#ffffff") >= 7 ? "#ffffff" : "#10191d";
    const genome = validateGenome({
      ...DEFAULT_GENOME,
      name: String(b.name || "Your brand").slice(0, 60),
      canvas,
      ink,
      muted: ink,
      accent,
      ...(typeof b.imageId === "string" ? { logoId: b.imageId } : {}),
    });
    return NextResponse.json({
      genome,
      method: origin,
      note: "Colors were extracted from supplied pixels or CSS. Lighting and motion use editable defaults; no vision judgement is claimed.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Brand extraction failed." },
      { status: 422 },
    );
  }
});
