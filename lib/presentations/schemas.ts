import { ARCHETYPES, ICON_NAMES, type Archetype } from "./archetypes";
import type { OutputSchema } from "@/lib/ai/router";
const text = (maxLength: number, description: string, minLength = 1) => ({
  type: "string",
  minLength,
  maxLength,
  description,
});
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const array = (items: unknown, minItems: number, maxItems = minItems) => ({
  type: "array",
  items,
  minItems,
  maxItems,
});
const evidence = (ids: string[]) =>
  array(
    ids.length ? { type: "string", enum: ids } : { type: "string" },
    0,
    ids.length ? 6 : 0,
  );
const card = () =>
  object({
    title: text(70, "At most five words."),
    body: text(180, "One line, at most twenty words."),
    icon: { type: "string", enum: ICON_NAMES },
  });
export function slideOutputSchema(
  archetype: Archetype,
  title: string,
  sourceIds: string[],
): OutputSchema {
  const source = {
    type: "string",
    enum: sourceIds.length ? sourceIds : ["no-source-available"],
  };
  const slots: Record<Archetype, Record<string, unknown>> = {
    hero_headline: {
      takeaway: text(180, "One line, at most twenty words."),
      callout: text(
        32,
        "At most four words; use empty string if not needed.",
        0,
      ),
      label: text(80, "At most eight words.", 0),
    },
    bento_grid_3: { cards: array(card(), 3) },
    metric_trio: {
      metrics: array(
        object({
          value: text(
            16,
            "Numerical statistic containing a digit, at most three words. Names are not metrics. Value must occur in the exact supporting excerpt.",
          ),
          label: text(65, "At most five words."),
          context: text(150, "At most eighteen words."),
          sourceId: source,
          excerpt: text(
            450,
            "Verbatim supporting source passage, at most fifty-five words.",
          ),
        }),
        3,
      ),
    },
    split_comparison: { left: card(), right: card() },
    linear_stepper: { steps: array(card(), 3, 4) },
    quote_attribution: {
      quote: text(260, "Verbatim source quotation, at most thirty-two words."),
      author: text(80, "A supplied author or publisher, at most six words."),
      credentials: text(
        90,
        "Only supplied credentials, at most eight words. Empty if unavailable.",
        0,
      ),
      sourceId: source,
    },
  };
  return {
    name: "presentation_slide",
    schema: object({
      archetype: { type: "string", enum: [archetype] },
      title: { type: "string", enum: [title] },
      eyebrow: text(40, "Exactly two or three words; one line."),
      notes: text(1800, "Private presenter detail and limitations.", 0),
      evidence: evidence(sourceIds),
      ...slots[archetype],
    }),
  };
}
export function storyboardOutputSchema(
  count: number,
  ids: string[],
): OutputSchema {
  return {
    name: "presentation_storyboard",
    schema: object({
      thesis: text(180, "At most twenty words."),
      beats: array(
        object({
          title: text(100, "Punchy title, at most eight words."),
          purpose: text(
            180,
            "At most twenty words. For metric_trio include three distinct numerical values present in cited sources; otherwise choose a qualitative layout.",
          ),
          role: {
            type: "string",
            enum: ["hook", "context", "pillar", "evidence", "takeaway"],
          },
          archetype: {
            type: "string",
            enum: ids.length
              ? ARCHETYPES
              : ARCHETYPES.filter(
                  (a) => !["metric_trio", "quote_attribution"].includes(a),
                ),
          },
          evidence: evidence(ids),
        }),
        count,
      ),
    }),
  };
}
