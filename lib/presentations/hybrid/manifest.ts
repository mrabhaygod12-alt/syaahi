import { validateManifest, type HybridPlan, type SlideManifest } from "./model";
export function manifestForBeat(
  plan: HybridPlan,
  index: number,
): SlideManifest {
  const beat = plan.beats[index];
  if (!beat) throw new Error("Storyboard beat not found.");
  const facts = beat.factIds.map((id) => plan.facts.find((f) => f.id === id)!);
  return validateManifest({
    version: 3,
    id: beat.id,
    headline: beat.title,
    category: beat.role === "hook" ? "THE BIG IDEA" : beat.role.toUpperCase(),
    thesis: beat.purpose,
    role: beat.role,
    visualEngine: beat.engine,
    metaphor: beat.metaphor,
    facts,
    notes: facts
      .map(
        (f) =>
          `${f.documentTitle}${f.pageNumber ? `, page ${f.pageNumber}` : ""}: “${f.exactQuote}”`,
      )
      .join("\n\n")
      .slice(0, 1800),
    duration:
      Math.round(
        10 *
          Math.max(
            7,
            Math.min(
              25,
              6 +
                facts.reduce((n, f) => n + f.statement.split(/\s+/).length, 0) /
                  2.8,
            ),
          ),
      ) / 10,
    visual: {
      seed: index * 7919 + 17,
      density: 0.6,
      speed: 0.35,
      exploded: false,
    },
    genome: plan.genome,
  });
}
