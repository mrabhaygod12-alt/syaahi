import type { ArchetypeSlide, SlideIcon } from "./archetypes";
import { DESIGN_TOKENS as T, semanticTheme } from "./theme";
import type { SlideObject } from "./model";
export type SceneElement = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
} & (
  | {
      type: "text";
      text: string;
      size: number;
      weight: number;
      align?: "left" | "center" | "right";
    }
  | { type: "surface"; radius: number; stroke?: string }
  | { type: "icon"; icon: SlideIcon }
);
/** Geometry is owned by the renderer and shared by React, HTML/PDF and PPTX. */
export function archetypeScene(
  s: ArchetypeSlide,
  theme: ReturnType<typeof semanticTheme>,
): SceneElement[] {
  const scene: SceneElement[] = [];
  const text = (
    id: string,
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size = T.body as number,
    weight = 400,
    color = theme.ink,
  ) =>
    scene.push({
      id,
      type: "text",
      text: value,
      x,
      y,
      w,
      h,
      size,
      weight,
      color,
    });
  const surface = (id: string, x: number, y: number, w: number, h: number) =>
    scene.push({
      id,
      type: "surface",
      x,
      y,
      w,
      h,
      color: theme.surface,
      radius: 14,
      stroke: theme.line,
    });
  const icon = (id: string, name: SlideIcon, x: number, y: number, size = 32) =>
    scene.push({
      id,
      type: "icon",
      icon: name,
      x,
      y,
      w: size,
      h: size,
      color: theme.accent,
    });
  text(
    "category-tag",
    s.eyebrow.toUpperCase(),
    64,
    64,
    1050,
    22,
    14,
    700,
    theme.accent,
  );
  text("title-box", s.title, 64, 106, 1152, 118, 44, 700);
  switch (s.archetype) {
    case "hero_headline":
      text("hero-takeaway", s.takeaway, 64, 270, 860, 96, 24, 400, theme.muted);
      if (s.callout) {
        text(
          "hero-callout",
          s.callout,
          64,
          388,
          900,
          166,
          64,
          800,
          theme.accent,
        );
        text("hero-label", s.label, 64, 578, 900, 46, 16, 400, theme.muted);
      }
      break;
    case "bento_grid_3":
      s.cards.forEach((c, i) => {
        const wide = i === 0,
          x = wide ? 64 : 756,
          y = wide ? 254 : 254 + (i - 1) * 200,
          w = wide ? 668 : 460,
          h = wide ? 376 : 176;
        surface(`card-surface-${i}`, x, y, w, h);
        icon(`card-icon-${i}`, c.icon, x + 32, y + 32, wide ? 40 : 28);
        text(
          `card-title-${i}`,
          c.title,
          x + (wide ? 32 : 72),
          y + (wide ? 114 : 24),
          w - (wide ? 64 : 96),
          wide ? 82 : 48,
          wide ? 30 : 18,
          700,
        );
        text(
          `card-body-${i}`,
          c.body,
          x + (wide ? 32 : 24),
          y + (wide ? 220 : 78),
          w - (wide ? 64 : 48),
          wide ? 96 : 74,
          wide ? 16 : 14,
          400,
          theme.muted,
        );
      });
      break;
    case "metric_trio":
      s.metrics.forEach((m, i) => {
        const x = 64 + i * 392;
        surface(`metric-surface-${i}`, x, 270, 368, 336);
        text(
          `metric-value-${i}`,
          m.value,
          x + 32,
          310,
          304,
          88,
          64,
          800,
          theme.accent,
        );
        text(`metric-label-${i}`, m.label, x + 32, 426, 304, 60, 24, 700);
        text(
          `metric-context-${i}`,
          m.context,
          x + 32,
          506,
          304,
          74,
          16,
          400,
          theme.muted,
        );
      });
      break;
    case "split_comparison":
      [s.left, s.right].forEach((c, i) => {
        const x = 64 + i * 588;
        surface(`comparison-surface-${i}`, x, 254, 564, 352);
        icon(`comparison-icon-${i}`, c.icon, x + 32, 286, 40);
        text(`comparison-title-${i}`, c.title, x + 32, 358, 500, 80, 30, 700);
        text(
          `comparison-body-${i}`,
          c.body,
          x + 32,
          458,
          500,
          110,
          16,
          400,
          theme.muted,
        );
      });
      break;
    case "linear_stepper":
      s.steps.forEach((c, i) => {
        const w = (1152 - (s.steps.length - 1) * 24) / s.steps.length,
          x = 64 + i * (w + 24);
        surface(`step-surface-${i}`, x, 254, w, 352);
        text(
          `step-number-${i}`,
          String(i + 1).padStart(2, "0"),
          x + 32,
          284,
          w - 64,
          72,
          56,
          800,
          theme.accent,
        );
        text(
          `step-title-${i}`,
          c.title,
          x + 24,
          366,
          w - 48,
          96,
          s.steps.length === 4 ? 18 : 24,
          700,
        );
        text(
          `step-body-${i}`,
          c.body,
          x + 24,
          470,
          w - 48,
          112,
          s.steps.length === 4 ? 14 : 16,
          400,
          theme.muted,
        );
      });
      break;
    case "quote_attribution":
      text("quote-mark", "“", 64, 235, 90, 120, 88, 700, theme.accent);
      text("quote-text", s.quote, 162, 272, 1054, 212, 36, 700);
      text("quote-author", s.author, 162, 522, 970, 40, 24, 700);
      text(
        "quote-credentials",
        s.credentials,
        162,
        572,
        970,
        24,
        14,
        400,
        theme.muted,
      );
      break;
  }
  return scene;
}
export function semanticObjects(
  slide: ArchetypeSlide,
  ink: string,
  accent: string,
  background = "F7F8F4",
): SlideObject[] {
  return archetypeScene(
    slide,
    semanticTheme("editorial", { background, ink, accent }),
  )
    .filter(
      (p): p is Extract<SceneElement, { type: "text" }> => p.type === "text",
    )
    .map((p) => ({
      id: p.id,
      type: "text",
      text: p.text,
      x: (p.x / T.width) * 100,
      y: (p.y / T.height) * 100,
      w: (p.w / T.width) * 100,
      h: (p.h / T.height) * 100,
      fontSize: p.size * 0.75,
      bold: p.weight >= 700,
      color: "#" + p.color,
      align: p.align || "left",
    }));
}
