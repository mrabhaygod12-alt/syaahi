import {
  DEFAULT_GENOME,
  type SlideManifest,
  type DesignGenome,
} from "@/lib/presentations/hybrid/model";
export function studioExample(
  genome: DesignGenome = DEFAULT_GENOME,
): SlideManifest {
  const statements = [
    "A readable story gives each slide one central idea.",
    "Source passages stay attached to the statements they support.",
    "A visual metaphor makes relationships easier to explore.",
  ];
  return {
    version: 3,
    id: "studio-illustration",
    headline: "Make a complex idea feel clear",
    category: "ILLUSTRATIVE STUDIO PREVIEW",
    thesis: "From evidence to a visual narrative",
    role: "hook",
    visualEngine: "three",
    metaphor: "orbital",
    facts: statements.map((statement, i) => ({
      id: `example-${i}`,
      statement,
      exactQuote: statement,
      sourceId: "illustrative-studio-copy",
      documentTitle: "Illustrative design brief",
      start: 0,
      end: statement.length,
      confidenceScore: 1,
    })),
    notes:
      "Illustrative interface preview. Not a generated or researched presentation.",
    duration: 12,
    visual: { seed: 17, density: 0.6, speed: 0.3, exploded: false },
    genome,
  };
}
