import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { inkAccount } from "@/lib/ink/access";
import { extractPdf, ExtractionError } from "@/lib/documents/extract";
import { rateLimit } from "@/lib/ratelimit";
import { officeText } from "@/lib/intake/office";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = apiHandler(async (req: NextRequest) => {
  const access = await inkAccount(req);
  if (access.response) return access.response;
  const limited = await rateLimit(req, "ink-import", 6, 3600000);
  if (limited) return limited;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Choose a document to upload." },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File) || !/\.(pdf|docx|txt|md|tex)$/i.test(file.name))
    return NextResponse.json(
      { error: "Choose a PDF or DOCX (10 MB), or UTF-8 text file (500 KB)." },
      { status: 400 },
    );
  if (file.size > 10 * 1024 * 1024)
    return NextResponse.json(
      { error: "Documents must be under 10 MB." },
      { status: 413 },
    );
  try {
    let text = "";
    if (/\.pdf$/i.test(file.name)) {
      const parsed = await extractPdf(
        new Uint8Array(await file.arrayBuffer()),
        { signal: req.signal, timeoutMs: 40000, maxCharacters: 120000 },
      );
      text = parsed.pages.map((p) => p.text).join("\n\n");
    } else if (/\.docx$/i.test(file.name)) {
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50)
        throw new Error("Invalid DOCX");
      // Existing ZIP reader bounds entry counts, expanded bytes and extraction
      // time. It reads document text only; external relationships are never fetched.
      text = await officeText(bytes, "docx", {
        maxText: 120000,
        rejectTruncation: true,
      });
    } else {
      if (file.size > 500000)
        return NextResponse.json(
          { error: "Text files must be under 500 KB." },
          { status: 413 },
        );
      text = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (text.includes("\0")) throw new Error("Binary input");
    }
    if (text.trim().length < 200 || text.length > 120000)
      return NextResponse.json(
        {
          error:
            "Use a searchable document containing 200–120,000 characters. Scanned PDFs need OCR before importing.",
        },
        { status: 422 },
      );
    return NextResponse.json({ text, name: file.name.slice(0, 160) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Could not read the complete document. Use a searchable PDF, a valid DOCX or UTF-8 text; split large chapters before importing.",
      },
      { status: error instanceof ExtractionError ? error.status : 422 },
    );
  }
});
