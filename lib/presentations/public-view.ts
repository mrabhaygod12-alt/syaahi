import type { DeckSlide } from "./model";
/** Keep presenter notes and extracted evidence out of every audience channel. */
export function audienceSlide(slide: DeckSlide): DeckSlide {
  const visible = {
    ...slide,
    notes: "",
    evidence: [],
    citations: slide.citations.map((c) =>
      c.split(" — ")[0].replace(/https?:\/\/\S+/gi, "Source link omitted"),
    ),
  };
  if (slide.manifest)
    visible.manifest = {
      ...slide.manifest,
      visualEngine:
        slide.manifest.visualEngine === "spline"
          ? "two"
          : slide.manifest.visualEngine,
      visual: { ...slide.manifest.visual, splineAssetId: undefined },
      notes: "",
      facts: slide.manifest.facts.map((f) => ({
        ...f,
        sourceId: "",
        exactQuote: f.statement,
        start: 0,
        end: f.statement.length,
      })),
      genome: { ...slide.manifest.genome, logoId: undefined },
    };
  if (slide.semantic) {
    visible.semantic = { ...slide.semantic, notes: "", evidence: [] };
    if (visible.semantic.archetype === "metric_trio")
      visible.semantic = {
        ...visible.semantic,
        metrics: visible.semantic.metrics.map((m) => ({
          ...m,
          excerpt: "",
          sourceId: "",
        })) as typeof visible.semantic.metrics,
      };
    if (visible.semantic.archetype === "quote_attribution")
      visible.semantic = { ...visible.semantic, sourceId: "" };
  }
  return visible;
}
export function citationCaption(slide: DeckSlide) {
  return slide.citations
    .map((c, i) => `[${i + 1}] ${c.split(" — ")[0].slice(0, 42)}`)
    .join(" · ")
    .slice(0, 155);
}
