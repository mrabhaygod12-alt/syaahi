import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  HeadingLevel,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { getAssignment } from "@/lib/assignments/store";
import { assignmentReferences } from "@/lib/assignments/engine";
import { renderPdf } from "@/lib/pdf/server";
import type { PrintNote } from "@/lib/pdf/document";
import { parseNote } from "@/lib/notes/parse";
import type { Block } from "@/lib/notes/parse";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const maxDuration = 60;

function pdfNotes(
  assignment: NonNullable<Awaited<ReturnType<typeof getAssignment>>>,
): PrintNote[] {
  const style = {
    font: assignment.font,
    ink: "#1c3d78",
    paper: assignment.paper,
    size: 22,
    jitter: 1,
  };
  const notes: PrintNote[] = assignment.sections.map((section, index) => ({
    topic: `${assignment.title} · ${index + 1}/${assignment.pageCount}`,
    markdown: `${index === 0 ? `## ${assignment.title}\n\n**Course:** ${assignment.course || "University study"}\n\n**AI-assisted study draft · verify claims and citations before submitting.**\n\n` : ""}${section.markdown}`,
    style,
    template: "study",
  }));
  const references = assignmentReferences(assignment);
  if (references.length)
    notes.push({
      topic: `${assignment.title} · References`,
      markdown: `## References\n\n${references.map((reference) => `- ${reference}`).join("\n")}`,
      style,
      template: "study",
    });
  return notes;
}

function runs(text: string, font: string) {
  const chunks = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return chunks.map(
    (part) =>
      new TextRun({
        text: part.startsWith("**") ? part.slice(2, -2) : part,
        bold: part.startsWith("**"),
        font,
        color: "17365D",
        size: 25,
      }),
  );
}

function docxBlock(
  block: Block,
  font: string,
  ruled: boolean,
): Array<Paragraph | Table> {
  const p = (
    text: string,
    opts: {
      bold?: boolean;
      size?: number;
      italic?: boolean;
      bullet?: boolean;
    } = {},
  ) =>
    new Paragraph({
      children: [
        new TextRun({
          text,
          font,
          color: "17365D",
          size: opts.size || 25,
          bold: opts.bold,
          italics: opts.italic,
        }),
      ],
      bullet: opts.bullet ? { level: 0 } : undefined,
      heading:
        opts.bold && opts.size === 36 ? HeadingLevel.HEADING_1 : undefined,
      spacing: { after: 120, line: 340 },
      border: ruled
        ? {
            bottom: {
              color: "DCE7F2",
              space: 3,
              size: 1,
              style: "single" as any,
            },
          }
        : undefined,
    });
  switch (block.kind) {
    case "title":
      return [p(block.text, { bold: true, size: 36 })];
    case "h3":
      return [p(block.text, { bold: true, size: 30 })];
    case "bullets":
      return block.items.map(
        (item) =>
          new Paragraph({
            children: runs(item, font),
            bullet: { level: 0 },
            spacing: { after: 100, line: 330 },
          }),
      );
    case "steps":
      return block.items.map((item, index) => p(`${index + 1}. ${item}`));
    case "table":
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [block.head, ...block.rows].map(
            (row) =>
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [new Paragraph({ children: runs(cell, font) })],
                    }),
                ),
              }),
          ),
        }),
      ];
    case "diagram":
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: block.labels.join("     ↓     "),
              font,
              color: "17365D",
              size: 25,
              bold: true,
            }),
          ],
          alignment: "center" as any,
          border: {
            top: { color: "7892B0", space: 5, size: 5, style: "single" as any },
            bottom: {
              color: "7892B0",
              space: 5,
              size: 5,
              style: "single" as any,
            },
          },
          spacing: { before: 160, after: 160 },
        }),
      ];
    case "illustration":
      return [
        p(`${block.caption}  →  ${block.labels.join("  →  ")}`, { bold: true }),
      ];
    case "definition":
      return [p(`Definition · ${block.text}`)];
    case "summary":
      return [p(`Summary · ${block.text}`, { bold: true })];
    case "alert":
      return [p(`Check · ${block.text}`, { italic: true })];
    case "margin":
      return [p(`Remember · ${block.text}`, { italic: true })];
    case "timeline":
    case "terms":
      return block.items.map(([left, right]) => p(`${left}  ·  ${right}`));
    case "code":
      return [p(block.text)];
    default:
      return [
        new Paragraph({
          children: runs((block as any).text || "", font),
          spacing: { after: 120, line: 340 },
          border: ruled
            ? {
                bottom: {
                  color: "DCE7F2",
                  space: 3,
                  size: 1,
                  style: "single" as any,
                },
              }
            : undefined,
        }),
      ];
  }
}

async function handleGET(req: NextRequest, context: Context) {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "assignment-export", 12, 60_000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const { id } = await context.params;
  const assignment = await getAssignment(id, user.id);
  if (!assignment)
    return NextResponse.json(
      { error: "Assignment not found." },
      { status: 404 },
    );
  if (assignment.status !== "ready")
    return NextResponse.json(
      {
        error: "Wait until all assignment sections are ready before exporting.",
      },
      { status: 409 },
    );
  const format = new URL(req.url).searchParams.get("format") || "pdf";
  const slug =
    assignment.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "assignment";
  if (format === "pdf") {
    const { bytes, pages } = await renderPdf(pdfNotes(assignment));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}.pdf"`,
        "X-Page-Count": String(pages),
        "Cache-Control": "private, no-store",
      },
    });
  }
  if (format !== "docx")
    return NextResponse.json(
      { error: "Choose PDF or DOCX export." },
      { status: 400 },
    );
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      children: [
        new TextRun({
          text: "SYAAHII · ASSIGNMENT STUDIO",
          font: "Aptos",
          color: "5F776A",
          size: 18,
          bold: true,
        }),
      ],
      spacing: { after: 140 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "AI-assisted study draft · Review, verify, and adapt before submission.",
          font: "Aptos",
          color: "8A5A42",
          size: 18,
          italics: true,
        }),
      ],
      spacing: { after: 240 },
    }),
  ];
  for (const [index, section] of assignment.sections.entries()) {
    if (index) children.push(new Paragraph({ children: [new PageBreak()] }));
    if (index === 0)
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: assignment.title,
              font: assignment.font,
              color: "17365D",
              size: 38,
              bold: true,
            }),
          ],
          spacing: { after: 180 },
        }),
      );
    for (const block of parseNote(section.markdown))
      children.push(
        ...docxBlock(block, assignment.font, assignment.paper === "ruled"),
      );
  }
  const references = assignmentReferences(assignment);
  if (references.length) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "References",
            font: assignment.font,
            color: "17365D",
            size: 34,
            bold: true,
          }),
        ],
        spacing: { after: 180 },
      }),
    );
    references.forEach((reference) =>
      children.push(
        new Paragraph({
          children: runs(reference, assignment.font),
          spacing: { after: 140, line: 330 },
          border:
            assignment.paper === "ruled"
              ? {
                  bottom: {
                    color: "DCE7F2",
                    space: 3,
                    size: 1,
                    style: "single" as any,
                  },
                }
              : undefined,
        }),
      ),
    );
  }
  const document = new Document({
    creator: "Syaahi Assignment Studio",
    title: assignment.title,
    description:
      "AI-assisted study draft. Review facts and sources before use.",
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 850, right: 900, bottom: 850, left: 1100 },
          },
        },
        children,
      },
    ],
    styles: {
      default: {
        document: { run: { font: assignment.font, size: 25, color: "17365D" } },
      },
    },
  });
  const bytes = await Packer.toBuffer(document);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${slug}.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export const GET = apiHandler(handleGET);
