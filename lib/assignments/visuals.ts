import type { AssignmentSection, AssignmentVisual } from "./types";

const MAX_LABEL_LENGTH = 52;

function cleanLabel(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace(/[|\u0000-\u001f]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\*\*/g, "")
        .trim()
        .slice(0, MAX_LABEL_LENGTH)
    : "";
}

export function normalizeAssignmentVisual(
  value: unknown,
): AssignmentVisual | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const kinds: AssignmentVisual["kind"][] = [
    "flow",
    "cycle",
    "layers",
    "decision",
    "concept",
  ];
  if (!kinds.includes(record.kind as AssignmentVisual["kind"])) return null;
  const labels = Array.isArray(record.labels)
    ? record.labels.map(cleanLabel).filter(Boolean).slice(0, 6)
    : [];
  const minimum = record.kind === "decision" ? 3 : 2;
  if (labels.length < minimum) return null;
  return {
    kind: record.kind as AssignmentVisual["kind"],
    title: cleanLabel(record.title) || "Key ideas at a glance",
    labels,
  };
}

function shortenHeading(value: string): string {
  const text = cleanLabel(value);
  return text.length > 46 ? `${text.slice(0, 43).trimEnd()}…` : text;
}

export function assignmentPathway(outline: string[]): AssignmentVisual {
  const labels = outline.map(shortenHeading).filter(Boolean).slice(0, 6);
  return {
    kind: "flow",
    title: "Assignment pathway",
    labels:
      labels.length >= 2
        ? labels
        : [
            "Define the question",
            "Review evidence",
            "Build analysis",
            "Conclude",
          ],
  };
}

export function fallbackConceptMap(
  section: Pick<AssignmentSection, "heading" | "markdown">,
): AssignmentVisual {
  const lines = section.markdown
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^#{1,6}\s*/, "")
        .replace(/^[-*•]\s*/, "")
        .replace(/^\*\*|\*\*$/g, "")
        .replace(/\[R\d+\]/g, "")
        .trim(),
    )
    .filter(
      (line) => line.length > 18 && !/^Diagram:|^Illustration:/i.test(line),
    );
  const ideas = lines
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map(cleanLabel)
    .filter((line) => line.length > 16)
    .slice(0, 4);
  const labels =
    ideas.length >= 2 ? ideas : ["Core idea", "Evidence", "Implication"];
  return {
    kind: "concept",
    title: shortenHeading(section.heading) || "Concept map",
    labels,
  };
}

export function assignmentSectionMarkdown(
  section: AssignmentSection,
  outline: string[] = [],
  index = -1,
): string {
  const visual =
    section.visual ||
    (index === 0 && outline.length > 1
      ? assignmentPathway(outline)
      : fallbackConceptMap(section));
  const body = section.markdown
    .replace(/^\s*(?:Diagram|Illustration)\s*:\s*.*$/gim, "")
    .trim();
  const line =
    visual.kind === "concept"
      ? `Illustration: ${visual.title} | ${visual.labels.join(" | ")}`
      : `Diagram: ${visual.kind} | ${visual.labels.join(" | ")}`;
  return `${body}\n\n### ${visual.title}\n\n${line}`;
}
