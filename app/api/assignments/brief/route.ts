import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { extractPdf, ExtractionError } from "@/lib/documents/extract";
import { officeText } from "@/lib/intake/office";

export const runtime = "nodejs";
export const maxDuration = 45;

export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "assignment-brief-upload", 5, 60_000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  if (user.workspace === "writer")
    return NextResponse.json(
      { error: "Switch to your student workspace to use Assignment Studio." },
      { status: 403 },
    );

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 10 * 1024 * 1024 + 64 * 1024)
    return NextResponse.json(
      { error: "Choose a text PDF under 10 MB." },
      { status: 413 },
    );
  const form = await req.formData().catch(() => null);
  const value = form?.get("file");
  if (!(value instanceof File))
    return NextResponse.json(
      { error: "Choose an assignment brief PDF." },
      { status: 400 },
    );
  if (value.size < 5 || value.size > 10 * 1024 * 1024)
    return NextResponse.json(
      { error: "Choose a PDF or DOCX between 5 bytes and 10 MB." },
      { status: 413 },
    );
  if (!/\.(pdf|docx)$/i.test(value.name))
    return NextResponse.json(
      { error: "Assignment brief upload supports PDF or DOCX files." },
      { status: 415 },
    );

  try {
    const bytes = new Uint8Array(await value.arrayBuffer());
    const isPdf = /\.pdf$/i.test(value.name);
    let text: string;
    let pageCount: number | null = null;
    if (isPdf) {
      if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-")
        return NextResponse.json(
          { error: "That file is not a valid PDF." },
          { status: 415 },
        );
      const result = await extractPdf(bytes, {
        signal: req.signal,
        timeoutMs: 35_000,
        maxCharacters: 30_000,
      });
      if (result.pageCount > 40)
        return NextResponse.json(
          { error: "Split this brief into a PDF of 40 pages or fewer." },
          { status: 413 },
        );
      pageCount = result.pageCount;
      text = result.pages
        .map((page) => page.text.trim())
        .filter(Boolean)
        .join("\n\n");
    } else {
      if (bytes.length < 4 || Buffer.from(bytes).readUInt32LE(0) !== 0x04034b50)
        return NextResponse.json(
          { error: "That file is not a valid DOCX document." },
          { status: 415 },
        );
      try {
        text = await officeText(Buffer.from(bytes), "docx", {
          maxText: 30_000,
          rejectTruncation: false,
        });
      } catch {
        throw new ExtractionError(
          "This DOCX could not be read safely. Try a smaller document.",
        );
      }
    }
    if (text.trim().length < 40)
      return NextResponse.json(
        {
          error:
            "We couldn’t find selectable text in that PDF. Paste the instructions, or use a text-based PDF.",
        },
        { status: 422 },
      );
    return NextResponse.json({
      fileName: value.name.replace(/[\\/\r\n]/g, " ").slice(0, 120),
      pageCount,
      text: text.slice(0, 24_000),
      truncated: text.length > 24_000,
      stored: false,
    });
  } catch (error) {
    if (error instanceof ExtractionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    throw error;
  }
});
