import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { saveDocument, listDocuments } from "@/lib/documents/store";

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
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const info = await parser.getInfo();
    if (info.total > 500)
      throw new Error("Split books larger than 500 pages into volumes.");
    const pages: Array<{ num: number; text: string }> = [];
    let characters = 0;
    const started = Date.now();
    for (let first = 1; first <= info.total; first += 20) {
      if (Date.now() - started > 90000)
        throw new Error(
          "Extraction took too long. Split this book into chapters.",
        );
      const partial = Array.from(
        { length: Math.min(20, info.total - first + 1) },
        (_, i) => first + i,
      );
      const result = await parser.getText({ partial });
      for (const page of result.pages) {
        characters += page.text.length;
        if (characters > 3000000)
          throw new Error(
            "Extracted text exceeds 3 million characters. Split the textbook into volumes.",
          );
        pages.push(page);
      }
    }
    const doc = await saveDocument(
      (await currentUser(req))!.id,
      file.name,
      info.total,
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
      { status: 422 },
    );
  } finally {
    await parser.destroy();
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
