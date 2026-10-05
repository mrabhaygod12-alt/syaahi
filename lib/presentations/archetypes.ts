/** Versioned semantic slide contract. Models supply content, never geometry. */
export const ARCHETYPES = [
  "hero_headline",
  "bento_grid_3",
  "metric_trio",
  "split_comparison",
  "linear_stepper",
  "quote_attribution",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];
export const ICON_NAMES = [
  "sparkles",
  "shield-check",
  "book-open",
  "chart-no-axes-combined",
  "lightbulb",
  "users",
  "target",
  "workflow",
  "leaf",
  "globe",
  "zap",
  "search",
] as const;
export type SlideIcon = (typeof ICON_NAMES)[number];
export interface CardSlot {
  title: string;
  body: string;
  icon: SlideIcon;
}
export interface MetricSlot {
  value: string;
  label: string;
  context: string;
  sourceId: string;
  excerpt: string;
}
interface Base {
  title: string;
  eyebrow: string;
  notes: string;
  evidence: string[];
}
export type ArchetypeSlide = Base &
  (
    | {
        archetype: "hero_headline";
        takeaway: string;
        callout: string;
        label: string;
      }
    | { archetype: "bento_grid_3"; cards: [CardSlot, CardSlot, CardSlot] }
    | {
        archetype: "metric_trio";
        metrics: [MetricSlot, MetricSlot, MetricSlot];
      }
    | { archetype: "split_comparison"; left: CardSlot; right: CardSlot }
    | { archetype: "linear_stepper"; steps: CardSlot[] }
    | {
        archetype: "quote_attribution";
        quote: string;
        author: string;
        credentials: string;
        sourceId: string;
      }
  );
export interface StoryBeat {
  title: string;
  purpose: string;
  role: "hook" | "context" | "pillar" | "evidence" | "takeaway";
  archetype: Archetype;
  evidence: string[];
}
export interface Storyboard {
  thesis: string;
  beats: StoryBeat[];
}
/** Reject numeric layouts before billing when the plan has no three cited values. */
export function verifyMetricPlan(
  beat: StoryBeat,
  sources: { id: string; text: string }[],
) {
  if (beat.archetype !== "metric_trio") return;
  const numbers = [
    ...new Set(beat.purpose.normalize("NFKC").match(/\d+(?:[.,]\d+)*/g) || []),
  ];
  const passages = sources
    .filter((s) => beat.evidence.includes(s.id))
    .map((s) => s.text.normalize("NFKC"));
  if (
    numbers.length < 3 ||
    numbers.some(
      (n) =>
        !passages.some((text) =>
          new Set<string>(text.match(/\d+(?:[.,]\d+)*/g) || []).has(n),
        ),
    )
  )
    throw new Error(
      "Metric trio needs three distinct source-supported numbers in the slide purpose. Choose Bento or Comparison for qualitative facts.",
    );
}
export const words = (s: string) =>
  s.trim().split(/\s+/u).filter(Boolean).length;
function copy(
  v: unknown,
  field: string,
  maxWords: number,
  maxChars: number,
  optional = false,
): string {
  if (
    typeof v !== "string" ||
    (!optional && !v.trim()) ||
    /[\r\n]/.test(v) ||
    words(v) > maxWords ||
    v.length > maxChars
  )
    throw new Error(
      `${field}: use one line, at most ${maxWords} words / ${maxChars} characters.`,
    );
  return v.trim();
}
function ids(v: unknown): string[] {
  if (
    !Array.isArray(v) ||
    v.length > 6 ||
    v.some((s) => typeof s !== "string" || !/^[-\w]{1,100}$/.test(s))
  )
    throw new Error("Evidence must contain supplied source IDs.");
  return [...new Set(v)] as string[];
}
export function semanticIcon(title: string): SlideIcon {
  const rules: [RegExp, SlideIcon][] = [
    [/secur|protect|risk|सुरक्षा/i, "shield-check"],
    [/learn|study|read|शिक्षा|अध्ययन/i, "book-open"],
    [/growth|data|result|measure|आंक/i, "chart-no-axes-combined"],
    [/people|team|community|समुदाय/i, "users"],
    [/process|step|flow|चरण/i, "workflow"],
    [/climat|nature|energy|पर्यावरण/i, "leaf"],
    [/goal|aim|target|लक्ष्य/i, "target"],
    [/research|find|search|खोज/i, "search"],
    [/world|global|विश्व/i, "globe"],
  ];
  return rules.find(([r]) => r.test(title))?.[1] || "lightbulb";
}
function card(v: any): CardSlot {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !["title", "body", "icon"].includes(k))
  )
    throw new Error("Card schema accepts only title, body and icon.");
  const title = copy(v?.title, "Card title", 5, 70);
  return {
    title,
    body: copy(v.body, "Card description", 20, 180),
    icon: ICON_NAMES.includes(v.icon) ? v.icon : semanticIcon(title),
  };
}
function exact(v: any, count: number, field: string) {
  if (!Array.isArray(v) || v.length !== count)
    throw new Error(`${field} requires exactly ${count} slots.`);
  return v;
}
export function validateArchetype(input: unknown): ArchetypeSlide {
  const v = input as any;
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    !ARCHETYPES.includes(v.archetype) ||
    ["x", "y", "w", "h", "objects", "coordinates"].some((k) => k in v)
  )
    throw new Error(
      "Select a semantic archetype; model coordinates are forbidden.",
    );
  const slots: Record<Archetype, string[]> = {
    hero_headline: ["takeaway", "callout", "label"],
    bento_grid_3: ["cards"],
    metric_trio: ["metrics"],
    split_comparison: ["left", "right"],
    linear_stepper: ["steps"],
    quote_attribution: ["quote", "author", "credentials", "sourceId"],
  };
  if (
    Object.keys(v).some(
      (k) =>
        ![
          "archetype",
          "title",
          "eyebrow",
          "notes",
          "evidence",
          ...slots[v.archetype as Archetype],
        ].includes(k),
    )
  )
    throw new Error("The selected archetype contains unsupported fields.");
  const base: Base = {
    title: copy(v.title, "Slide title", 8, 100),
    eyebrow: copy(v.eyebrow, "Category", 3, 40),
    notes: typeof v.notes === "string" ? v.notes.slice(0, 1800) : "",
    evidence: ids(v.evidence || []),
  };
  if (/^(introduction|overview)$/i.test(base.title))
    throw new Error("Use a specific slide title.");
  if (words(base.eyebrow) < 2)
    throw new Error("Category: use two or three words.");
  switch (v.archetype as Archetype) {
    case "hero_headline":
      return {
        ...base,
        archetype: v.archetype,
        takeaway: copy(v.takeaway, "Takeaway", 20, 180),
        callout: copy(v.callout, "Callout", 4, 32, true),
        label: copy(v.label, "Callout label", 8, 80, true),
      };
    case "bento_grid_3":
      return {
        ...base,
        archetype: v.archetype,
        cards: exact(v.cards, 3, "Bento").map(card) as [
          CardSlot,
          CardSlot,
          CardSlot,
        ],
      };
    case "metric_trio":
      return {
        ...base,
        archetype: v.archetype,
        metrics: exact(v.metrics, 3, "Metrics").map((m): MetricSlot => {
          if (
            !m ||
            typeof m !== "object" ||
            Array.isArray(m) ||
            Object.keys(m).some(
              (k) =>
                !["value", "label", "context", "sourceId", "excerpt"].includes(
                  k,
                ),
            )
          )
            throw new Error(
              "Metric schema accepts only value, label, context, sourceId and excerpt.",
            );
          return {
            value: (() => {
              const value = copy(m.value, "Metric", 3, 16);
              if (!/\d/u.test(value.normalize("NFKC")))
                throw new Error(
                  "Metric values must be numerical; names and qualitative labels belong in Bento cards.",
                );
              return value;
            })(),
            label: copy(m.label, "Metric label", 5, 65),
            context: copy(m.context, "Metric context", 18, 150),
            sourceId: copy(m.sourceId, "Metric source", 1, 100),
            excerpt: copy(m.excerpt, "Supporting excerpt", 55, 450),
          };
        }) as [MetricSlot, MetricSlot, MetricSlot],
      };
    case "split_comparison":
      return {
        ...base,
        archetype: v.archetype,
        left: card(v.left),
        right: card(v.right),
      };
    case "linear_stepper": {
      if (!Array.isArray(v.steps) || ![3, 4].includes(v.steps.length))
        throw new Error("A stepper requires three or four phases.");
      return { ...base, archetype: v.archetype, steps: v.steps.map(card) };
    }
    case "quote_attribution":
      return {
        ...base,
        archetype: v.archetype,
        quote: copy(v.quote, "Quote", 32, 260),
        author: copy(v.author, "Author", 6, 80),
        credentials: copy(v.credentials, "Credentials", 8, 90, true),
        sourceId: copy(v.sourceId, "Quote source", 1, 100),
      };
  }
}
export function validateStoryboard(input: unknown, count: number): Storyboard {
  const v = input as any;
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !["thesis", "beats"].includes(k))
  )
    throw new Error("Storyboard accepts only thesis and beats.");
  const beats = exact(v?.beats, count, "Storyboard").map((b): StoryBeat => {
    if (
      !b ||
      typeof b !== "object" ||
      Array.isArray(b) ||
      Object.keys(b).some(
        (k) =>
          !["title", "purpose", "role", "archetype", "evidence"].includes(k),
      ) ||
      !ARCHETYPES.includes(b?.archetype) ||
      !["hook", "context", "pillar", "evidence", "takeaway"].includes(b.role)
    )
      throw new Error("Invalid storyboard role or archetype.");
    return {
      title: copy(b.title, "Slide title", 8, 100),
      purpose: copy(b.purpose, "Slide purpose", 20, 180),
      role: b.role,
      archetype: b.archetype,
      evidence: ids(b.evidence || []),
    };
  });
  if (
    beats[0].role !== "hook" ||
    beats.at(-1)?.role !== "takeaway" ||
    !beats.some((b) => b.role === "context")
  )
    throw new Error(
      "The story must open with a hook, establish context and close with a takeaway.",
    );
  if (count >= 7 && beats.filter((b) => b.role === "pillar").length < 3)
    throw new Error("A longer narrative requires three core pillars.");
  if (beats.length >= 4 && new Set(beats.map((b) => b.archetype)).size < 3)
    throw new Error("Choose varied visual archetypes.");
  return { thesis: copy(v.thesis, "Thesis", 20, 180), beats };
}
/** Structural grounding checks do not claim to prove semantic truth. */
export function verifyGrounding(
  slide: ArchetypeSlide,
  sources: { id: string; text: string; name?: string }[],
) {
  const find = (id: string) => sources.find((s) => s.id === id);
  if (slide.evidence.some((id) => !find(id)))
    throw new Error("Unknown evidence source.");
  const normalize = (s: string) =>
    s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  if (slide.archetype === "metric_trio")
    for (const m of slide.metrics) {
      const source = find(m.sourceId);
      if (
        !source ||
        !slide.evidence.includes(m.sourceId) ||
        !normalize(source.text).includes(normalize(m.excerpt))
      )
        throw new Error(
          "Every metric needs an exact supporting excerpt from a supplied source.",
        );
      const numbers = m.value.match(/\d[\d.,]*/g) || [];
      if (!numbers.length || numbers.some((n) => !m.excerpt.includes(n)))
        throw new Error(
          "Metric values must appear in their supporting excerpt. Do not invent or silently calculate values.",
        );
    }
  if (slide.archetype === "quote_attribution") {
    const source = find(slide.sourceId);
    if (
      !source ||
      !slide.evidence.includes(slide.sourceId) ||
      !normalize(source.text).includes(normalize(slide.quote))
    )
      throw new Error("Quotes must be verbatim from a supplied source.");
    if (
      !normalize(source.text + " " + (source.name || "")).includes(
        normalize(slide.author),
      )
    )
      throw new Error(
        "Quote attribution must name an author or publisher present in the supplied source.",
      );
    if (
      slide.credentials &&
      !normalize(source.text).includes(normalize(slide.credentials))
    )
      throw new Error(
        "Use only verbatim supplied credentials, or leave credentials empty.",
      );
  }
}
export function archetypeExample(archetype: Archetype): ArchetypeSlide {
  const base = {
    title: "Ideas deserve a clearer story",
    eyebrow: "Design direction",
    notes: "Example content for template preview.",
    evidence: [] as string[],
  };
  const c = (title: string, body: string): CardSlot => ({
    title,
    body,
    icon: semanticIcon(title),
  });
  switch (archetype) {
    case "hero_headline":
      return {
        ...base,
        archetype,
        takeaway: "Give one strong idea the space to be understood.",
        callout: "One idea",
        label: "A focused starting point",
      };
    case "bento_grid_3":
      return {
        ...base,
        archetype,
        cards: [
          c(
            "A story with purpose",
            "Build the narrative around the question your audience needs answered.",
          ),
          c(
            "Ground the evidence",
            "Keep the original source beside every important claim.",
          ),
          c(
            "Make room to think",
            "Short copy and consistent spacing help the message land.",
          ),
        ],
      };
    case "metric_trio":
      return {
        ...base,
        archetype,
        metrics: ["24%", "3×", "18"].map((value, i) => ({
          value,
          label: ["Example growth", "Example reach", "Example teams"][i],
          context: "Illustrative template data; replace with sourced evidence.",
          sourceId: "example",
          excerpt: "Illustrative template data 24% 3× 18",
        })) as [MetricSlot, MetricSlot, MetricSlot],
      };
    case "split_comparison":
      return {
        ...base,
        archetype,
        left: c(
          "Before",
          "Scattered notes make the main point harder to find.",
        ),
        right: c("After", "A clear narrative puts the useful evidence first."),
      };
    case "linear_stepper":
      return {
        ...base,
        archetype,
        steps: [
          c("Research", "Gather the relevant source material."),
          c("Shape", "Review the story before building."),
          c("Present", "Edit the details and share the result."),
        ],
      };
    case "quote_attribution":
      return {
        ...base,
        archetype,
        quote: "A clear idea deserves a clear presentation.",
        author: "Sample attribution",
        credentials: "Illustrative quote",
        sourceId: "example",
      };
  }
}
