/** The model selects data and presets; it never supplies executable code or coordinates. */
export const VISUAL_ENGINES = [
  "three",
  "babylon",
  "ogl",
  "pixi",
  "two",
  "shader",
  "curtains",
  "p5",
  "spline",
  "webgpu",
] as const;
export type VisualEngine = (typeof VISUAL_ENGINES)[number];
export const VISUAL_METAPHORS = [
  "orbital",
  "architecture",
  "network",
  "flow",
  "comparison",
  "particles",
  "terrain",
  "timeline",
] as const;
export type VisualMetaphor = (typeof VISUAL_METAPHORS)[number];
export interface FactCitation {
  id: string;
  statement: string;
  sourceId: string;
  documentTitle: string;
  pageNumber?: number;
  exactQuote: string;
  start: number;
  end: number;
  confidenceScore: number; // Verified quotation integrity, NOT probability a source is factually correct.
}
export interface DesignGenome {
  name: string;
  canvas: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  secondary: string;
  font: "Arial" | "Georgia" | "Aptos" | "Nirmala UI";
  lighting: "studio" | "neon" | "soft";
  damping: number;
  logoId?: string;
}
export interface SlideManifest {
  version: 3;
  id: string;
  headline: string;
  category: string;
  thesis: string;
  role: "hook" | "context" | "pillar" | "evidence" | "takeaway";
  visualEngine: VisualEngine;
  metaphor: VisualMetaphor;
  facts: FactCitation[];
  notes: string;
  duration: number;
  visual: {
    seed: number;
    density: number;
    speed: number;
    exploded: boolean;
    splineAssetId?: string;
  };
  genome: DesignGenome;
}
export interface HybridBeat {
  id: string;
  title: string;
  purpose: string;
  role: SlideManifest["role"];
  factIds: string[];
  engine: VisualEngine;
  metaphor: VisualMetaphor;
}
export interface HybridPlan {
  version: 3;
  thesis: string;
  beats: HybridBeat[];
  facts: FactCitation[];
  genome: DesignGenome;
  budget: {
    requested: number;
    allocated: number;
    credits: number;
    evidenceCap: number;
    planCap: number;
    balance: number;
    explanation: string;
  };
  research: Array<{
    query: string;
    provider: string;
    results: number;
    status: "complete" | "unavailable";
    at: string;
  }>;
  context: { characters: number; mode: "full-source"; truncation: false };
}
export interface QualityReport {
  version: 3;
  status: "passed" | "failed";
  checkedAt: string;
  citationCount: number;
  checks: {
    name: string;
    status: "passed" | "fallback" | "skipped" | "failed";
    detail: string;
  }[];
  issues: string[];
  renderer: "webgl" | "vector-fallback";
}
export const DEFAULT_GENOME: DesignGenome = {
  name: "Syaahi midnight",
  canvas: "#10191d",
  surface: "#1b292e",
  ink: "#f5f8f6",
  muted: "#c2d1cd",
  accent: "#b8e4c4",
  secondary: "#9db8ec",
  font: "Arial",
  lighting: "studio",
  damping: 0.85,
};
export const GENOMES: DesignGenome[] = [
  DEFAULT_GENOME,
  {
    ...DEFAULT_GENOME,
    name: "Research paper",
    canvas: "#f8f6f0",
    surface: "#ece9df",
    ink: "#1e302c",
    muted: "#354d45",
    accent: "#27644e",
    secondary: "#6655a0",
    font: "Georgia",
    lighting: "soft",
  },
  {
    ...DEFAULT_GENOME,
    name: "Deep blue",
    canvas: "#101b34",
    surface: "#1a2a49",
    ink: "#f5f8ff",
    muted: "#c8d4e9",
    accent: "#a8dce8",
    secondary: "#ccbaff",
    lighting: "neon",
  },
  {
    ...DEFAULT_GENOME,
    name: "Clay archive",
    canvas: "#241d1a",
    surface: "#352925",
    ink: "#fff6eb",
    muted: "#e0c9ba",
    accent: "#eec09c",
    secondary: "#bdd4ba",
    font: "Georgia",
    lighting: "soft",
  },
];
const words = (s: string) => s.trim().split(/\s+/u).filter(Boolean).length;
export function contrast(a: string, b: string) {
  const lum = (s: string) => {
    const rgb = [1, 3, 5]
      .map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function validateGenome(value: unknown): DesignGenome {
  const g = value as DesignGenome;
  if (
    !g ||
    ![g.canvas, g.surface, g.ink, g.muted, g.accent, g.secondary].every((c) =>
      /^#[a-f0-9]{6}$/i.test(c),
    ) ||
    !["Arial", "Georgia", "Aptos", "Nirmala UI"].includes(g.font) ||
    !["studio", "neon", "soft"].includes(g.lighting) ||
    !Number.isFinite(g.damping) ||
    g.damping < 0.1 ||
    g.damping > 0.99 ||
    contrast(g.canvas, g.ink) < 7 ||
    contrast(g.canvas, g.muted) < 4.5
  )
    throw new Error(
      "Use a readable brand palette: 7:1 headline and 4.5:1 secondary contrast are required.",
    );
  if (g.logoId && !/^[a-f0-9-]{36}$/i.test(g.logoId))
    throw new Error("Invalid brand logo.");
  return {
    name: String(g.name || "Custom brand").slice(0, 60),
    canvas: g.canvas,
    surface: g.surface,
    ink: g.ink,
    muted: g.muted,
    accent: g.accent,
    secondary: g.secondary,
    font: g.font,
    lighting: g.lighting,
    damping: g.damping,
    ...(g.logoId ? { logoId: g.logoId } : {}),
  };
}
export function validateManifest(value: unknown): SlideManifest {
  const s = value as SlideManifest;
  if (
    !s ||
    s.version !== 3 ||
    typeof s.id !== "string" ||
    !/^[a-z0-9-]{1,90}$/i.test(s.id) ||
    typeof s.headline !== "string" ||
    !s.headline.trim() ||
    s.headline.length > 100 ||
    words(s.headline) > 8 ||
    typeof s.thesis !== "string" ||
    s.thesis.length > 160 ||
    typeof s.category !== "string" ||
    s.category.length > 40 ||
    !VISUAL_ENGINES.includes(s.visualEngine) ||
    !VISUAL_METAPHORS.includes(s.metaphor) ||
    !["hook", "context", "pillar", "evidence", "takeaway"].includes(s.role) ||
    !Array.isArray(s.facts) ||
    !s.facts.length ||
    s.facts.length > 3 ||
    typeof s.notes !== "string" ||
    s.notes.length > 1800 ||
    !Number.isFinite(s.duration) ||
    s.duration < 5 ||
    s.duration > 30
  )
    throw new Error("Invalid source-backed slide manifest.");
  for (const f of s.facts)
    if (
      !f ||
      typeof f.id !== "string" ||
      typeof f.sourceId !== "string" ||
      typeof f.documentTitle !== "string" ||
      f.documentTitle.length > 300 ||
      typeof f.statement !== "string" ||
      !f.statement.trim() ||
      words(f.statement) > 24 ||
      f.statement.length > 240 ||
      typeof f.exactQuote !== "string" ||
      f.exactQuote.length > 700 ||
      !Number.isFinite(f.confidenceScore) ||
      f.confidenceScore !== 1 ||
      (f.pageNumber !== undefined &&
        (!Number.isInteger(f.pageNumber) || f.pageNumber < 1)) ||
      f.exactQuote !== f.statement ||
      !Number.isInteger(f.start) ||
      f.start < 0 ||
      f.end !== f.start + f.exactQuote.length
    )
      throw new Error("Every slide statement needs an exact source span.");
  const v = s.visual;
  if (
    !v ||
    !Number.isSafeInteger(v.seed) ||
    v.seed < 0 ||
    !Number.isFinite(v.density) ||
    v.density < 0.1 ||
    v.density > 1 ||
    !Number.isFinite(v.speed) ||
    v.speed < 0 ||
    v.speed > 2 ||
    (v.splineAssetId && !/^[a-f0-9-]{36}$/i.test(v.splineAssetId))
  )
    throw new Error("Use supported visual parameters.");
  return {
    version: 3,
    id: s.id,
    headline: s.headline,
    category: s.category,
    thesis: s.thesis,
    role: s.role,
    visualEngine: s.visualEngine,
    metaphor: s.metaphor,
    notes: s.notes,
    duration: s.duration,
    facts: s.facts.map((f) => ({
      id: f.id,
      statement: f.statement,
      sourceId: f.sourceId,
      documentTitle: f.documentTitle,
      exactQuote: f.exactQuote,
      start: f.start,
      end: f.end,
      confidenceScore: 1,
      ...(f.pageNumber ? { pageNumber: f.pageNumber } : {}),
    })),
    genome: validateGenome(s.genome),
    visual: {
      seed: v.seed,
      density: v.density,
      speed: v.speed,
      exploded: v.exploded === true,
      ...(v.splineAssetId ? { splineAssetId: v.splineAssetId } : {}),
    },
  };
}
export const hybridCredits = (count: number) =>
  5 + Math.max(0, Math.ceil((count - 10) / 5)) * 2;
