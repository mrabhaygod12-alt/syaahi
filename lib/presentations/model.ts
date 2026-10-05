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
export const SLIDE_LAYOUTS = [
  "cover",
  "points",
  "comparison",
  "process",
  "table",
  "chart",
  "agenda",
  "quote",
  "timeline",
  "image",
  "recap",
  "case",
] as const;
export interface SlideObject {
  id: string;
  type: "text" | "image";
  text: string;
  imageId?: string;
  imageAlt?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  bold: boolean;
  color: string;
  align: "left" | "center" | "right";
}
export interface BrandKit {
  id: string;
  name: string;
  version: number;
  background: string;
  ink: string;
  accent: string;
  font: "Arial" | "Aptos" | "Georgia" | "Nirmala UI";
}
export interface DeckSlide {
  id?: string;
  title: string;
  layout: (typeof SLIDE_LAYOUTS)[number];
  subtitle: string;
  bullets: string[];
  columns: Array<{ title: string; points: string[] }>;
  steps: string[];
  table: string[][];
  chart: { labels: string[]; values: number[]; label: string } | null;
  notes: string;
  citations: string[];
  imageId?: string;
  imageAlt?: string;
  objects?: SlideObject[];
  evidence?: string[];
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
  const layout = (SLIDE_LAYOUTS as readonly string[]).includes(s.layout || "")
    ? s.layout!
    : "points";
  const columns = Array.isArray(s.columns)
    ? s.columns.slice(0, 2).map((c) => ({
        title: text(c?.title, 70),
        points: list(c?.points, 4, 160),
      }))
    : [];
  const table = Array.isArray(s.table)
    ? s.table
        .slice(0, 6)
        .map((row) =>
          Array.isArray(row)
            ? row.slice(0, 4).map((cell) => text(cell, 100))
            : [],
        )
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
    (["comparison", "case"].includes(layout) && columns.length !== 2) ||
    (["process", "timeline"].includes(layout) && list(s.steps).length < 2) ||
    (layout === "table" &&
      (table.length < 2 ||
        table.some((row) => row.length !== table[0].length))) ||
    (layout === "chart" && !chart)
  )
    throw new Error("Slide layout has incomplete content.");
  const objects = Array.isArray(s.objects)
    ? s.objects.slice(0, 24).map(validateObject)
    : undefined;
  if (objects && new Set(objects.map((o) => o.id)).size !== objects.length)
    throw new Error("Object IDs must be unique.");
  return {
    ...(typeof s.id === "string" && /^[-\w]{8,80}$/.test(s.id)
      ? { id: s.id }
      : {}),
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
    ...(typeof s.imageId === "string" && /^[-\w]{8,80}$/.test(s.imageId)
      ? { imageId: s.imageId, imageAlt: text(s.imageAlt, 200) }
      : {}),
    ...(objects ? { objects } : {}),
    evidence: list(s.evidence, 8, 120),
  };
}
export function validateObject(value: unknown): SlideObject {
  const o = value as SlideObject;
  if (
    !o ||
    !/^[-\w]{8,80}$/.test(o.id) ||
    !["text", "image"].includes(o.type) ||
    ![o.x, o.y, o.w, o.h, o.fontSize].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    ) ||
    o.x < 0 ||
    o.y < 0 ||
    o.w < 2 ||
    o.h < 2 ||
    o.x + o.w > 100 ||
    o.y + o.h > 100 ||
    o.fontSize < 10 ||
    o.fontSize > 72 ||
    !/^#[a-f0-9]{6}$/i.test(o.color) ||
    !["left", "center", "right"].includes(o.align) ||
    (o.type === "image" && !/^[a-f0-9-]{36}$/.test(o.imageId || ""))
  )
    throw new Error("Keep the object inside the slide and use a 10–72pt font.");
  return {
    id: o.id,
    type: o.type,
    text: text(o.text, 1500),
    ...(o.type === "image"
      ? { imageId: o.imageId, imageAlt: text(o.imageAlt, 200) }
      : {}),
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    fontSize: o.fontSize,
    bold: o.bold === true,
    color: o.color,
    align: o.align,
  };
}
export function validateBrand(value: unknown): BrandKit {
  const b = value as BrandKit;
  if (
    !b ||
    ![b.background, b.ink, b.accent].every((c) => /^[a-f0-9]{6}$/i.test(c)) ||
    !["Arial", "Aptos", "Georgia", "Nirmala UI"].includes(b.font) ||
    !text(b.name, 60)
  )
    throw new Error("Choose a name, six-digit colours and a supported font.");
  return {
    id: text(b.id, 80),
    version: Number.isInteger(b.version) && b.version >= 0 ? b.version : 0,
    name: text(b.name, 60),
    background: b.background.toUpperCase(),
    ink: b.ink.toUpperCase(),
    accent: b.accent.toUpperCase(),
    font: b.font,
  };
}
function luminance(hex: string) {
  const rgb = hex
    .replace("#", "")
    .match(/../g)!
    .map((h) => {
      const c = parseInt(h, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
export function slideQuality(
  slide: DeckSlide,
  theme: { background: string; ink: string },
) {
  const warnings: string[] = [];
  if (slide.title.length > 75)
    warnings.push("Shorten the heading to avoid overflow.");
  if (slide.bullets.join(" ").split(/\s+/).length > 90)
    warnings.push("Reduce body copy to around 90 words.");
  if (contrast(theme.background, theme.ink) < 4.5)
    warnings.push("Body text contrast is below 4.5:1.");
  for (const o of slide.objects || []) {
    if (o.fontSize < 16) warnings.push("A text object is smaller than 16pt.");
    if (contrast(theme.background, o.color) < 4.5)
      warnings.push("A text object has low contrast.");
    if (o.text.length > (o.w * o.h) / (o.fontSize / 16))
      warnings.push("A text object may overflow its box. Review the preview.");
  }
  if (slide.chart && !slide.chart.label.trim())
    warnings.push("Add chart units and an axis/series label.");
  if (
    /\d/.test(slide.bullets.join(" ")) &&
    !slide.evidence?.length &&
    !slide.citations.length
  )
    warnings.push("Check numerical claims against a supplied source.");
  if (slide.layout === "image" && !slide.imageId)
    warnings.push("Add an image and alt text for this layout.");
  return [...new Set(warnings)];
}
export function parseModelJson(value: string) {
  return JSON.parse(
    value.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""),
  );
}
