import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError } from "@/lib/auth/server";
import { noteHtml, renderPdf } from "@/lib/pdf/server";
import { rateLimit } from "@/lib/ratelimit";
import type { PrintNote } from "@/lib/pdf/document";
export const runtime = "nodejs";
export const maxDuration = 60;
async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "export", 30, 60000));
  if (denied) return denied;
  const raw = await req.text();
  if (raw.length > 500000)
    return NextResponse.json(
      { error: "Export is too large." },
      { status: 413 },
    );
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid export." }, { status: 400 });
  }
  if (
    !Array.isArray(body.notes) ||
    body.notes.length < 1 ||
    body.notes.length > 48 ||
    body.notes.some(
      (n: PrintNote) =>
        !n || typeof n.markdown !== "string" || n.markdown.length > 20000,
    )
  )
    return NextResponse.json(
      { error: "Supply 1-48 notes, each under 20,000 characters." },
      { status: 400 },
    );
  try {
    if (body.preview)
      return new Response(noteHtml(body.notes), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    const { bytes, pages } = await renderPdf(body.notes);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="syaahi-notes.pdf"',
        "X-Page-Count": String(pages),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF layout failure", error);
    return NextResponse.json(
      {
        error:
          "PDF could not be rendered. Check Chromium is installed, then retry.",
      },
      { status: 503 },
    );
  }
}

export const POST = apiHandler(handlePOST);
