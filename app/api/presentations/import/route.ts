import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { extractPdf, ExtractionError } from "@/lib/documents/extract";
import { saveDocument } from "@/lib/documents/store";
import { officeText } from "@/lib/intake/office";
export const runtime = "nodejs";
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "presentation-import", 12, 3600000));
  if (denied) return denied;
  const file = (await req.formData()).get("file");
  if (
    !(file instanceof File) ||
    !file.size ||
    file.size > 10 * 1024 * 1024 ||
    !/[.](pdf|docx|txt|md)$/i.test(file.name)
  )
    return NextResponse.json(
      { error: "Upload PDF, DOCX, TXT or Markdown up to 10 MB." },
      { status: 400 },
    );
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    let pages: Array<{ num: number; text: string }>;
    if (/\.pdf$/i.test(file.name)) {
      if (bytes.subarray(0, 5).toString() !== "%PDF-")
        throw new Error("Invalid PDF file.");
      pages = (await extractPdf(bytes, { signal: req.signal })).pages;
    } else {
      const text = /\.docx$/i.test(file.name)
        ? await officeText(bytes, "docx", {
            maxText: 1200000,
            rejectTruncation: true,
          })
        : new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0") || text.length > 1200000)
        throw new Error(
          "Use readable UTF-8 text within the 1.2M-character complete-source budget.",
        );
      pages = [{ num: 1, text }];
    }
    if (pages.reduce((n, p) => n + p.text.length, 0) > 1200000)
      throw new Error(
        "This document exceeds the full-source budget. Split it before importing; no text was discarded.",
      );
    const doc = await saveDocument(
      (await currentUser(req))!.id,
      file.name,
      pages.length,
      pages,
    );
    return NextResponse.json(
      {
        source: {
          kind: "document",
          id: doc.id,
          name: doc.name,
          pageCount: doc.pageCount,
        },
        preview: pages[0]?.text.slice(0, 500),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Source could not be imported.",
      },
      { status: error instanceof ExtractionError ? error.status : 422 },
    );
  }
});
