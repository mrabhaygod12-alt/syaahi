import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { rateLimit } from "@/lib/ratelimit";
import { resource } from "@/lib/growth/resources";
import { renderPdf } from "@/lib/pdf/server";
import { DEFAULT_STYLE } from "@/lib/handwriting/options";
const cache = new Map<string, Buffer>();
const pending = new Map<string, Promise<Buffer>>();
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await rateLimit(req, "resource-pdf", 6, 60000);
  if (denied) return denied;
  const key = req.nextUrl.searchParams.get("id") || "",
    language =
      req.nextUrl.searchParams.get("language") === "hindi"
        ? "hindi"
        : "english";
  const r = resource(key, language);
  if (!r)
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  const id = key + ":" + language;
  let bytes = cache.get(id);
  if (!bytes) {
    let task = pending.get(id);
    if (!task) {
      task = renderPdf([
        {
          markdown: r.body,
          style: { ...DEFAULT_STYLE, paper: "cream" },
          footer: "Original revision resource",
        },
      ]).then((r) => {
        cache.set(id, r.bytes);
        return r.bytes;
      });
      pending.set(id, task);
    }
    try {
      bytes = await task;
    } finally {
      pending.delete(id);
    }
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="syaahi-${key}.pdf"`,
      "Cache-Control": "public,max-age=86400",
    },
  });
});
