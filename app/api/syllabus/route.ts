import { apiHandler } from "@/lib/api-handler";
import { authError } from "@/lib/auth/server";
import { NextResponse } from "next/server";
import { heuristicSplit } from "@/lib/ai/prompts";
import { officeText } from "@/lib/intake/office";
import { rateLimit } from "@/lib/ratelimit";
export const runtime = "nodejs";
async function handlePOST(req: Request) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "documents", 10, 60000));
  if (denied) return denied;
  let text = "",
    source = "pasted text";
  try {
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const file = (await req.formData()).get("file");
      if (!(file instanceof File) || file.size > 10 * 1024 * 1024)
        return NextResponse.json(
          { error: "Choose a document under 10 MB." },
          { status: 400 },
        );
      const buf = Buffer.from(await file.arrayBuffer());
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "pdf") {
        if (buf.subarray(0, 5).toString() !== "%PDF-")
          throw new Error("Upload a valid PDF.");
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        try {
          text = (await parser.getText()).text.slice(0, 100000);
        } finally {
          await parser.destroy();
        }
      } else if (extension === "docx" || extension === "pptx") {
        if (buf[0] !== 0x50 || buf[1] !== 0x4b)
          throw new Error("Upload a valid Office document.");
        text = await officeText(buf, extension);
      } else if (extension === "txt" || extension === "md") {
        text = buf.toString("utf8").slice(0, 100000);
      } else
        throw new Error(
          "Supported documents: PDF, DOCX, PPTX, TXT, and Markdown.",
        );
      source = file.name;
    } else {
      text = String((await req.json()).text || "").slice(0, 100000);
    }
    if (text.trim().length < 10)
      throw new Error(
        "No readable text found. For scans or image-only slides, upload a screenshot instead.",
      );
    return NextResponse.json({
      text,
      context: text,
      source,
      chars: text.length,
      topics: heuristicSplit(text, 24),
      warning:
        text.length >= 100000
          ? "Only the first 100,000 characters were extracted. Split large documents for complete coverage."
          : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Document extraction failed." },
      { status: 400 },
    );
  }
}

export const POST = apiHandler(handlePOST);
