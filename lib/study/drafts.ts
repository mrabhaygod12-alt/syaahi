import { sectionGoals } from "@/lib/lesson/sections";
import { scanReviews } from "@/lib/study/scans";
const strings = (value: unknown, max: number, limit: number) =>
  Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string")
        .slice(0, max)
        .map((v) => v.slice(0, limit))
    : [];
function links(value: unknown) {
  return Array.isArray(value)
    ? value.slice(0, 20).flatMap((v) => {
        if (
          !v ||
          typeof v !== "object" ||
          typeof v.title !== "string" ||
          typeof v.url !== "string"
        )
          return [];
        try {
          const u = new URL(v.url);
          return ["https:", "http:"].includes(u.protocol) &&
            !u.username &&
            !u.password
            ? [
                {
                  title: v.title.slice(0, 200),
                  url: u.href.slice(0, 1000),
                  ...(v.kind === "search" || v.kind === "source"
                    ? { kind: v.kind }
                    : {}),
                },
              ]
            : [];
        } catch {
          return [];
        }
      })
    : [];
}
export function composerDraft(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    JSON.stringify(value).length > 240000
  )
    throw new Error("Invalid draft or source limit exceeded.");
  const v = value as Record<string, any>,
    d: Record<string, unknown> = {};
  for (const key of [
    "text",
    "context",
    "source",
    "sourceUrl",
    "language",
    "detail",
    "learningGoal",
    "outline",
  ]) {
    if (v[key] !== undefined) {
      if (typeof v[key] !== "string") throw new Error("Invalid draft field.");
      d[key] = v[key].slice(
        0,
        ["text", "context", "outline"].includes(key) ? 100000 : 2000,
      );
    }
  }
  if (v.research !== undefined) {
    if (typeof v.research !== "boolean")
      throw new Error("Invalid research setting.");
    d.research = v.research;
  }
  if (v.pages !== undefined) {
    if (!Number.isInteger(v.pages) || v.pages < 0 || v.pages > 24)
      throw new Error("Invalid planned page count.");
    d.pages = v.pages;
  }
  if (v.sections !== undefined)
    d.sections = sectionGoals(
      typeof d.outline === "string"
        ? d.outline
            .split("\n")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 24)
        : [],
      v.sections,
    );
  if ([1, 2, 3].includes(v.stage)) d.stage = v.stage;
  if (v.scans !== undefined) d.scans = scanReviews(v.scans);
  if (
    v.document &&
    typeof v.document.id === "string" &&
    typeof v.document.name === "string" &&
    Number.isInteger(v.document.pageCount) &&
    v.document.pageCount > 0 &&
    v.document.pageCount <= 500
  )
    d.document = {
      id: v.document.id.slice(0, 80),
      name: v.document.name.slice(0, 160),
      pageCount: v.document.pageCount,
    };
  if (
    v.documentRange &&
    [v.documentRange.from, v.documentRange.to].every(
      (n) => Number.isInteger(n) && n >= 1 && n <= 500,
    ) &&
    v.documentRange.from <= v.documentRange.to
  )
    d.documentRange = { from: v.documentRange.from, to: v.documentRange.to };
  if (v.plan && typeof v.plan === "object" && !Array.isArray(v.plan)) {
    const p = v.plan;
    d.plan = {
      topics: strings(p.topics, 24, 160),
      context: typeof p.context === "string" ? p.context.slice(0, 100000) : "",
      sources: links(p.sources),
      readingLinks: links(p.readingLinks),
      evidence: typeof p.evidence === "string" ? p.evidence.slice(0, 100) : "",
      reason: typeof p.reason === "string" ? p.reason.slice(0, 2000) : "",
      note: typeof p.note === "string" ? p.note.slice(0, 2000) : "",
    };
  }
  return d;
}
