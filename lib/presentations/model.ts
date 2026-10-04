export const DECK_TEMPLATES = {
  editorial: {
    name: "Editorial",
    background: "F7F8F4",
    ink: "183F35",
    accent: "267360",
  },
  technical: {
    name: "Technical",
    background: "101E32",
    ink: "F2F6FC",
    accent: "53BCD8",
  },
  classroom: {
    name: "Classroom",
    background: "FFFFFF",
    ink: "18354A",
    accent: "296BC0",
  },
} as const;
export type DeckTemplate = keyof typeof DECK_TEMPLATES;
export interface DeckSlide {
  title: string;
  layout: "cover" | "points" | "comparison" | "process" | "table" | "chart";
  subtitle: string;
  bullets: string[];
  columns: Array<{ title: string; points: string[] }>;
  steps: string[];
  table: string[][];
  chart: { labels: string[]; values: number[]; label: string } | null;
  notes: string;
  citations: string[];
}
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
export function validateSlide(input: unknown): DeckSlide {
  const s = input as Partial<DeckSlide>;
  if (!s || !text(s.title, 110)) throw new Error("Slide requires a title.");
  const list = (value: unknown, count = 5, max = 200): string[] =>
    Array.isArray(value)
      ? value
          .slice(0, count)
          .map((v) => text(v, max))
          .filter(Boolean)
      : [];
  const layout = [
    "cover",
    "points",
    "comparison",
    "process",
    "table",
    "chart",
  ].includes(s.layout || "")
    ? s.layout!
    : "points";
  const columns = Array.isArray(s.columns)
    ? s.columns
        .slice(0, 2)
        .map((c) => ({
          title: text(c?.title, 70),
          points: list(c?.points, 4, 160),
        }))
    : [];
  const table = Array.isArray(s.table)
    ? s.table.slice(0, 6).map((row) => list(row, 4, 100))
    : [];
  let chart: DeckSlide["chart"] = null;
  if (
    s.chart &&
    Array.isArray(s.chart.labels) &&
    Array.isArray(s.chart.values)
  ) {
    const labels = list(s.chart.labels, 6, 35),
      values = s.chart.values.slice(0, labels.length);
    if (
      labels.length >= 2 &&
      values.length === labels.length &&
      values.every(
        (v) =>
          typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e12,
      )
    )
      chart = { labels, values, label: text(s.chart.label, 70) };
  }
  if (
    (layout === "comparison" && columns.length !== 2) ||
    (layout === "process" && list(s.steps).length < 2) ||
    (layout === "table" &&
      (table.length < 2 ||
        table.some((row) => row.length !== table[0].length))) ||
    (layout === "chart" && !chart)
  )
    throw new Error("Slide layout has incomplete content.");
  return {
    title: text(s.title, 110),
    layout,
    subtitle: text(s.subtitle, 220),
    bullets: list(s.bullets),
    columns,
    steps: list(s.steps, 5, 90),
    table,
    chart,
    notes: text(s.notes, 1800),
    citations: list(s.citations, 4, 350),
  };
}
export function parseModelJson(value: string) {
  return JSON.parse(
    value.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""),
  );
}
