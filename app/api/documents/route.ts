import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { saveDocument, listDocuments } from "@/lib/documents/store";
import { extractPdf, ExtractionError } from "@/lib/documents/extract";

export const runtime = "nodejs";
export const maxDuration = 120;
async function upload(req: NextRequest) {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "textbook-upload", 3, 3600000));
  if (denied) return denied;
  const file = (await req.formData()).get("file");
  if (
    !(file instanceof File) ||
    file.size > 10 * 1024 * 1024 ||
    !file.name.toLowerCase().endsWith(".pdf")
  )
    return NextResponse.json(
      { error: "Choose a text PDF up to 10 MB and 500 pages." },
      { status: 400 },
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    return NextResponse.json({ error: "Invalid PDF file." }, { status: 400 });
  try {
    const { pageCount, pages } = await extractPdf(bytes, {
      signal: req.signal,
    });
    const doc = await saveDocument(
      (await currentUser(req))!.id,
      file.name,
      pageCount,
      pages,
    );
    return NextResponse.json(
      {
        id: doc.id,
        name: doc.name,
        pageCount: doc.pageCount,
        chunks: doc.chunks.length,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Textbook extraction failed.",
      },
      { status: error instanceof ExtractionError ? error.status : 422 },
    );
  }
}
export const POST = apiHandler(upload);
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  return NextResponse.json({
    documents: await listDocuments((await currentUser(req))!.id),
  });
});
