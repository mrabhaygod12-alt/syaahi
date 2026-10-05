import type { BrandKit, DeckTemplate } from "./model";
import { DECK_TEMPLATES } from "./model";
export const DESIGN_TOKENS = {
  width: 1280,
  height: 720,
  margin: 64,
  cardPadding: 32,
  gap: 24,
  title: 44,
  eyebrow: 14,
  stat: 64,
  body: 16,
  lineHeight: 1.35,
  allocation: { canvas: 60, surfaces: 30, accent: 10 },
} as const;
export function semanticTheme(
  template: DeckTemplate,
  brand?: Pick<BrandKit, "background" | "ink" | "accent"> & {
    font?: BrandKit["font"];
  },
) {
  const palette = brand || DECK_TEMPLATES[template];
  const rgb = (hex: string) => hex.match(/../g)!.map((n) => parseInt(n, 16));
  const [r, g, b] = rgb(palette.background);
  const dark = r * 0.2126 + g * 0.7152 + b * 0.0722 < 120;
  const blend = (ratio: number) =>
    rgb(palette.background)
      .map((v, i) =>
        Math.round(v * (1 - ratio) + rgb(palette.ink)[i] * ratio)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  return {
    background: palette.background,
    ink: palette.ink,
    accent: palette.accent,
    surface: blend(0.065),
    muted: blend(0.7),
    line: blend(0.16),
    font: brand?.font || "Arial",
    dark,
  };
}
export const TEMPLATE_CATALOG = [
  {
    id: "editorial",
    name: "Field notes",
    category: "Editorial",
    description: "Warm paper, forest ink and quiet contrast.",
  },
  {
    id: "technical",
    name: "Night signal",
    category: "Technology",
    description: "Dark slate and a bright cyan accent.",
  },
  {
    id: "classroom",
    name: "Clear lesson",
    category: "Education",
    description: "White canvas with a confident blue accent.",
  },
  {
    id: "studio",
    name: "Studio violet",
    category: "Creative",
    description: "Soft lilac and deep violet typography.",
  },
  {
    id: "terracotta",
    name: "Clay journal",
    category: "Editorial",
    description: "Sand surfaces and warm terracotta.",
  },
  {
    id: "ocean",
    name: "Ocean research",
    category: "Research",
    description: "Pale blue, navy ink and vivid teal.",
  },
  {
    id: "graphite",
    name: "Graphite report",
    category: "Business",
    description: "Crisp neutrals with a restrained orange accent.",
  },
  {
    id: "botanical",
    name: "Botanical",
    category: "Education",
    description: "Soft green with grounded olive details.",
  },
  {
    id: "rose",
    name: "Rose paper",
    category: "Creative",
    description: "Warm rose and expressive plum ink.",
  },
] as const;
