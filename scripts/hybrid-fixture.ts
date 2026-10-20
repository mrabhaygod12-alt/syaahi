import { randomUUID } from "node:crypto";
import { DEFAULT_GENOME } from "../lib/presentations/hybrid/model";
import type { HybridGenerate } from "../lib/presentations/hybrid/pipeline";
export const evidenceLines = [
  "A database transaction groups related changes into one unit.",
  "Atomicity means that a transaction completes or rolls back.",
  "Isolation controls how concurrent transactions observe changes.",
  "Durability preserves committed changes after a system restart.",
  "Indexes can reduce the number of records examined by a query.",
  "An execution plan describes how a database evaluates a query.",
  "A backup must be tested by restoring it into another database.",
  "Parameterized queries keep user values separate from SQL syntax.",
];
export const fixtureSource = {
  id: "text-grounded-fixture",
  kind: "text" as const,
  name: "Database lecture",
  text:
    "[Database lecture, page 1]\n" +
    evidenceLines.slice(0, 4).join("\n") +
    "\n[Database lecture, page 2]\n" +
    evidenceLines.slice(4).join("\n"),
};
export const fixtureGenerate: HybridGenerate = async (messages) => {
  const request = JSON.parse(
    messages.findLast((m) => m.role === "user" && m.content.startsWith("{"))!
      .content,
  );
  if (request.task === "extract-evidence")
    return {
      provider: "fixture",
      text: JSON.stringify({
        facts: evidenceLines.map((exactQuote) => ({
          sourceId: request.fullSources[0].id,
          exactQuote,
        })),
      }),
    };
  const count = Number(request.task.match(/Create (\d+)/)[1]);
  return {
    provider: "fixture",
    text: JSON.stringify({
      thesis: "Use database guarantees deliberately",
      beats: request.facts.slice(0, count).map((f: any, i: number) => ({
        id: randomUUID(),
        title: [
          "Protect every transaction",
          "Make atomic changes",
          "Control concurrent readers",
          "Preserve committed work",
          "Measure query cost",
          "Inspect execution plans",
          "Test recovery early",
          "Separate code from values",
        ][i],
        purpose: "Explain the quoted database principle",
        role:
          i === 0
            ? "hook"
            : i === count - 1
              ? "takeaway"
              : i === 1
                ? "context"
                : "pillar",
        factIds: [f.id],
        engine: i === 1 ? "two" : "three",
        metaphor: i === 1 ? "timeline" : "architecture",
      })),
    }),
  };
};
export async function fixtureDraft(owner: string) {
  const { createHybridDraft } =
    await import("../lib/presentations/hybrid/create");
  const { saveDocument } = await import("../lib/documents/store"),
    document = await saveDocument(owner, "Database lecture", 2, [
      { num: 1, text: evidenceLines.slice(0, 4).join("\n") },
      { num: 2, text: evidenceLines.slice(4).join("\n") },
    ]);
  return createHybridDraft(
    owner,
    {
      prompt:
        "Explain database reliability to postgraduate computer science students",
      count: 6,
      language: "english",
      audience: "MCA students",
      liveResearch: false,
      sources: [{ kind: "document", id: document.id }],
      genome: DEFAULT_GENOME,
    },
    fixtureGenerate,
  );
}
export async function fixtureDeck(owner: string) {
  const draft = await fixtureDraft(owner),
    { createDeck, processDeck, ownedDeck } =
      await import("../lib/presentations/store");
  const deck = await createDeck(owner, {
    prompt: draft.prompt,
    context: "PRIVATE SOURCE CONTEXT",
    language: draft.language,
    template: draft.template,
    count: draft.count,
    outline: draft.outline,
    sources: draft.sources,
    designEngine: 3,
    hybridPlan: draft.hybridPlan,
  });
  await processDeck(deck.id);
  return (await ownedDeck(owner, deck.id))!;
}
