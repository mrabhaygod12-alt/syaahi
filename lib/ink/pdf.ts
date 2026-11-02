import PDFDocument from "pdfkit";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { openSync, type Font } from "fontkit";
import type { InkReport } from "./store";
import { filterMatches, type MatchFilters } from "./filters";
import { reportFindings, matchGroups } from "./report-model";
let fonts: { body: Font; hindi: Font } | undefined;

/** No HTML, remote fonts, remote images or network access during export. */
export async function integrityPdf(
  report: InkReport,
  filters: MatchFilters,
): Promise<Buffer> {
  const regular = resolve(process.cwd(), "lib/ink/fonts/NotoSans.ttf");
  const hindi = resolve(process.cwd(), "lib/ink/fonts/NotoSansDevanagari.ttf");
  fonts ||= { body: openSync(regular) as Font, hindi: openSync(hindi) as Font };
  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    bufferPages: true,
    font: regular,
    info: {
      Title: report.title,
      Author: "AI Ink by Syaahii",
      Subject: "Private document similarity and evidence report",
    },
  });
  doc.registerFont("body", regular);
  doc.registerFont("hindi", hindi);
  const parts: Buffer[] = [];
  const output = new Promise<Buffer>((done, fail) => {
    doc.on("data", (c) => parts.push(c));
    doc.on("end", () => done(Buffer.concat(parts)));
    doc.on("error", fail);
  });
  const width = doc.page.width - 96,
    green = "#244b43",
    muted = "#596961";

  function page() {
    doc.addPage();
  }
  function room(height: number) {
    if (doc.y + height > doc.page.height - 70) page();
  }
  function line(
    value: string,
    size = 10,
    color = "#24362f",
    opts: PDFKit.Mixins.TextOptions = {},
  ) {
    const rendered = [...value]
      .map((c) => {
        if (/\s|[\u200c\u200d]/u.test(c)) return c;
        const font = /[\u0900-\u097f]/u.test(c) ? fonts!.hindi : fonts!.body;
        return font.hasGlyphForCodePoint(c.codePointAt(0)!)
          ? c
          : `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`;
      })
      .join("");
    const lines = rendered.split("\n");
    lines.forEach((part, p) => {
      const runs = part.match(
        /[\u0900-\u097f\u200c\u200d]+|[^\u0900-\u097f\u200c\u200d]+/gu,
      ) || [""];
      runs.forEach((run, i) => {
        doc
          .font(/[\u0900-\u097f]/.test(run) ? "hindi" : "body")
          .fontSize(size)
          .fillColor(color);
        doc.text(run, {
          width,
          lineGap: 4,
          underline: false,
          ...opts,
          continued:
            i < runs.length - 1 ||
            p < lines.length - 1 ||
            opts.continued === true,
        });
      });
      if (p < lines.length - 1) {
        doc.text("\n", { width, lineGap: 4, continued: false });
        doc.x = 48;
      }
    });
  }
  function title(value: string) {
    room(60);
    doc.moveDown(0.6);
    line(value, 19, green);
    doc.moveDown(0.4);
  }
  function rule() {
    const y = doc.y + 8;
    doc
      .moveTo(48, y)
      .lineTo(48 + width, y)
      .strokeColor("#dce3db")
      .stroke();
    doc.y = y + 18;
  }
  const view = filterMatches(report.text, report.match, filters),
    match = view.match;
  const findings = reportFindings(report.text, match);
  const digest = createHash("sha256").update(report.text).digest("hex");
  line("AI INK / SYAAHII", 11, green);
  doc.moveDown(2);
  line("Document integrity report", 28, green);
  doc.moveDown(0.6);
  line(report.title, 17);
  rule();
  line("PRIVATE SNAPSHOT", 9, muted);
  line(report.id, 9);
  line(`Checked: ${new Date(report.createdAt).toISOString()}`, 9);
  line(`Method: ${report.methodVersion || "legacy snapshot"}`, 9);
  doc.moveDown();
  line(
    report.comparedSources
      ? `${Math.round(match.coverage * 100)}% text similarity`
      : "Similarity not measured",
    32,
    green,
  );
  line(
    `${match.matchedWords} matched / ${view.eligibleWords} eligible words. Raw similarity: ${report.comparedSources ? Math.round(report.match.coverage * 100) + "%" : "unmeasured"}.`,
    10,
  );
  line(
    `${report.words.toLocaleString()} document words | ${report.comparedSources} compared sources | ${match.sourceCount} matching sources`,
    10,
  );
  doc.moveDown();
  line(
    "Similarity is not a plagiarism verdict. It describes matching text in the sources actually compared. No AI-authorship or AI-image probability was calculated.",
    10,
    muted,
  );
  line(
    "PDF fonts cover Latin, Greek, Cyrillic and Devanagari. Unsupported characters appear as [U+XXXX]; the private web report and JSON retain the original text.",
    8,
    muted,
  );
  title("Applied filters");
  line(
    `Bibliography: ${filters.bibliography ? "excluded" : "included"} | Paired quotations: ${filters.quotes ? "excluded" : "included"}`,
  );
  line(
    `Minimum run: ${Math.max(12, Math.min(100, filters.minWords))} words | Excluded sources: ${filters.excludedSources.length} | Excluded words: ${view.excludedWords}`,
  );
  title("Passage review groups");
  for (const g of matchGroups(report.text, match))
    line(`${g.count}   ${g.label}`);
  line(
    "Groups count passages, not unique words. A nearby citation marker does not establish attribution to the matched source.",
    9,
    muted,
  );
  if (report.match.limited || report.phrasing?.limited) {
    doc.moveDown();
    line(
      "PARTIAL REVIEW: a comparison or evidence budget was reached.",
      10,
      "#a04a28",
    );
  }
  page();
  title("Coverage and integrity");
  line(`Web discovery: ${report.search.status}. ${report.search.message}`);
  for (const c of report.coverage || []) {
    room(90);
    doc.moveDown(0.6);
    line(`${c.provider} / ${c.status}`, 12, green);
    line(c.message);
    line(
      `${c.discovered} discovered records; ${c.compared} text sources compared.`,
      9,
      muted,
    );
  }
  if (!report.coverage)
    line(
      "Legacy report: complete source coverage and integrity ledgers were not recorded.",
    );
  title("Text integrity flags");
  if (report.integrity) {
    line(report.integrity.message, 9, muted);
    if (!report.integrity.flags.length)
      line(
        "No flags in supported text checks. This does not certify originality.",
      );
    for (const f of report.integrity.flags) {
      line(`${f.kind}: ${f.count}`, 11, green);
      line(f.message);
    }
  } else line("Not recorded in this snapshot.");
  page();
  title("Numbered matching sources");
  if (!match.sources.length)
    line(
      "No matching sources under these filters. Unavailable sources were not checked.",
    );
  match.sources.forEach((s, i) => {
    room(110);
    line(`${i + 1}. ${s.source.title}`, 13, green);
    line(
      `${s.matchedWords} matching words (${Math.round(s.coverage * 100)}%); ${s.spans.length} passages`,
      10,
    );
    line(
      `${s.source.provider || s.source.kind} / ${s.source.scope || "supplied comparison text"}`,
      9,
      muted,
    );
    if (s.source.url) line(s.source.url, 9, muted);
    doc.moveDown();
  });
  title("Comparison ledger");
  for (const s of report.evidence || []) {
    room(110);
    line(s.title, 11, green);
    line(
      `${s.provider} / ${s.scope} / ${s.characters} characters / ${s.matchedWords} matched words${s.truncated ? " / truncated" : ""}`,
      9,
    );
    if (s.retrievedAt) line(`Retrieved: ${s.retrievedAt}`, 9, muted);
    if (s.url) line(s.url, 9, muted);
    line(`SHA-256: ${s.sha256}`, 8, muted);
    doc.moveDown(0.6);
  }
  page();
  title("Passage evidence");
  line(
    "Passage locations use extracted-text character offsets. They are not original PDF page coordinates. Source percentages can overlap.",
    9,
    muted,
  );
  line(
    "PDF evidence appendix: at most 80 passages, with 1,000 characters per excerpt. Longer or additional evidence remains in the private report and JSON export.",
    9,
    muted,
  );
  const excerpt = (value: string) =>
    value.length > 1000 ? value.slice(0, 1000) + " [excerpt shortened]" : value;
  findings.slice(0, 80).forEach((f, i) => {
    room(100);
    rule();
    line(
      `Match ${i + 1} / Source ${f.sourceNumber} / ${f.words} words`,
      12,
      f.color,
    );
    line(`Extracted characters ${f.start + 1}-${f.end}`, 8, muted);
    line("SUBMITTED PASSAGE", 8, green);
    line(excerpt(f.text));
    doc.moveDown(0.4);
    line("SOURCE EXCERPT", 8, f.color);
    line(excerpt(f.sourceText));
  });
  if (report.phrasing?.candidates.length) {
    title("Shared-phrasing candidates");
    line(
      "Lexical review only. These do not contribute to exact similarity. At most 20 candidates are included in this PDF.",
      9,
      muted,
    );
    for (const c of report.phrasing.candidates.slice(0, 20)) {
      if (filters.excludedSources.includes(c.source.id)) continue;
      room(100);
      line(c.source.title, 11, green);
      line(`Your text: ${excerpt(c.text)}`);
      line(`Source excerpt: ${excerpt(c.source.text)}`, 10, muted);
      doc.moveDown();
    }
  }
  page();
  title("Reference audit");
  line(
    "Supported citation formats only. Metadata does not verify that a source supports a claim.",
    9,
    muted,
  );
  for (const issue of report.citations.issues || []) {
    room(65);
    line(issue.kind.replaceAll("-", " "), 11, green);
    line(issue.text);
    doc.moveDown(0.5);
  }
  if (!report.citations.issues?.length)
    line("No supported reference-list issues flagged.");
  title("Claims requiring review");
  for (const c of report.citations.uncited) {
    room(65);
    line(c.text);
    line(c.reason, 9, muted);
    doc.moveDown(0.5);
  }
  title("DOI metadata verification");
  line(report.scholarly?.message || "Not requested.");
  for (const r of report.scholarly?.records || []) {
    room(65);
    line(`${r.doi} / Crossref: ${r.status} / Scopus: ${r.scopus}`, 9);
    if (r.title) line(r.title, 10);
  }
  page();
  title("Submitted manuscript");
  line(
    "Reflowed extracted text. Colored, underlined passages carry source numbers. Overlapping sources use the first highlight; all matches remain in the evidence section. Original document layout and image content are not reproduced.",
    9,
    muted,
  );
  doc.moveDown();
  // Render stable character ranges; AI never supplies page coordinates.
  let cursor = 0;
  const fragment = (value: string, color = "#24362f", underline = false) => {
    for (let i = 0; i < value.length; i += 4000)
      line(value.slice(i, i + 4000), 10, color, { continued: true, underline });
  };
  for (const f of [...findings].sort(
    (a, b) => a.start - b.start || b.end - a.end,
  )) {
    if (f.start < cursor) continue;
    fragment(report.text.slice(cursor, f.start));
    line(`[${f.sourceNumber}] `, 8, f.color, { continued: true });
    fragment(report.text.slice(f.start, f.end), f.color, true);
    cursor = f.end;
  }
  fragment(report.text.slice(cursor));
  line("\n", 10);
  rule();
  line(`Submission text SHA-256: ${digest}`, 8, muted);
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("body").fontSize(8).fillColor(muted);
    doc.text(
      "AI Ink by Syaahii | Private evidence report",
      48,
      doc.page.height - 38,
      { width: width - 90, lineBreak: false },
    );
    doc.text(
      `${i + 1} / ${range.count}`,
      doc.page.width - 120,
      doc.page.height - 38,
      { width: 72, align: "right", lineBreak: false },
    );
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return output;
}
