import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { analyse } from "../lib/ink/analyse";
import {
  discoverResearch,
  openAlexSources,
  researchJson,
} from "../lib/ink/research";
import { auditIntegrity } from "../lib/ink/integrity";
import { integrityPdf } from "../lib/ink/pdf";
import { DEFAULT_MATCH_FILTERS } from "../lib/ink/filters";
import { reportFindings } from "../lib/ink/report-model";
import { discoverSources } from "../lib/ink/search";
async function main() {
  const original = globalThis.fetch;
  const originalTavily = process.env.TAVILY_API_KEY;
  let calls = 0;
  const passage =
    "Machine learning models require careful evaluation using representative training collections before their results can support a responsible research conclusion about practical deployment.";
  const abstract =
    passage +
    " The authors discuss validation, public benchmarks and independent replication across several experimental settings.";
  const inverted: Record<string, number[]> = {};
  abstract.split(" ").forEach((w, i) => (inverted[w] ||= []).push(i));
  const fixture = {
    results: [
      {
        id: "https://openalex.org/W123",
        title: "Representative evaluation",
        abstract_inverted_index: inverted,
      },
    ],
  };
  globalThis.fetch = async (input, init) => {
    calls++;
    assert.equal(new URL(String(input)).origin, "https://api.openalex.org");
    assert.equal(init?.redirect, "error");
    return Response.json(fixture);
  };
  try {
    await discoverResearch(abstract, false);
    assert.equal(calls, 0, "no external disclosure without opt-in");
    const found = await discoverResearch(abstract, true);
    assert.equal(found.sources.length, 1);
    assert.equal(found.sources[0].scope, "abstract");
    assert.equal(found.sources[0].text, abstract);
    assert.equal(
      openAlexSources([
        { id: "https://attacker.test/W1", abstract_inverted_index: inverted },
      ]).length,
      0,
    );
    assert.equal(
      openAlexSources([
        { id: "https://openalex.org/W12", abstract_inverted_index: null },
      ]).length,
      0,
    );
    const analysis = await analyse({
      text: `The source states "${passage}" [1].\n\n${abstract}\n\nस्रोत और संदर्भ की जाँच करें। Review the evidence carefully.\n\nReferences\n[1] Smith, J. (2024). Evaluation methods.`,
      allowResearch: true,
    });
    assert.equal(analysis.evidence?.length, 1);
    assert.equal(analysis.evidence![0].scope, "abstract");
    assert.equal(analysis.evidence![0].sha256.length, 64);
    assert(analysis.evidence![0].matchedWords > 0);
    assert.equal(analysis.match.sources[0].source.text, "");
    assert(
      analysis.coverage?.some(
        (c) => c.provider === "ScienceDirect" && c.status === "not-configured",
      ),
    );
    assert(
      reportFindings(analysis.text, analysis.match).some(
        (f) => f.group === "quoted-citation",
      ),
    );
    const analysis2 = await analyse({
      text: abstract,
      sources: [
        {
          id: "unmatched",
          kind: "upload",
          title: "Unrelated source",
          text: "Astronomers observe distant stellar objects through telescopes and collect spectral evidence to understand their composition. ".repeat(
            3,
          ),
        },
      ],
    });
    assert.equal(
      analysis2.evidence![0].matchedWords,
      0,
      "no-match sources remain in ledger",
    );
    const flags = auditIntegrity(
      "normal\u200btext a\u202eb a\u0430\u0430 Hindi हिन्दी",
    );
    assert.equal(flags.flags.length, 3);
    assert.equal(auditIntegrity("हिन्दी\u200d").flags.length, 0);
    globalThis.fetch = async () => {
      throw Error("fixture offline");
    };
    assert.equal(
      (await discoverResearch(abstract, true)).trace.status,
      "unavailable",
    );
    await assert.rejects(
      researchJson(new Response("x".repeat(1000001))),
      /limit/,
    );
    process.env.TAVILY_API_KEY = "local-fixture";
    globalThis.fetch = async () =>
      Response.json({
        results: [
          {
            title: "Snippet fallback",
            url: "https://example.org/paper",
            raw_content: "   ",
            content: abstract,
          },
          {
            title: "Credential URL",
            url: "https://secret@example.org/paper",
            content: abstract,
          },
        ],
      });
    const snippets = await discoverSources([abstract]);
    assert.equal(snippets.sources.length, 1);
    assert.equal(
      snippets.sources[0].scope,
      "snippet",
      "empty page text must not be called a full-page comparison",
    );
    const report = {
      ...analysis,
      id: "ink-report-synthetic-evidence",
      kind: "ink-report",
      owner: "fixture-only",
      title: "Research integrity — synthetic verification",
      createdAt: "2026-11-02T07:00:00.000Z",
      updatedAt: "2026-11-02T07:00:00.000Z",
    };
    const bytes = await integrityPdf(report, DEFAULT_MATCH_FILTERS);
    assert(
      (bytes.toString("latin1").match(/\/Type \/Page\b/g) || []).length <= 8,
      "footer rendering must not create blank pages",
    );
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    if (process.argv.includes("--pdf")) {
      mkdirSync("output/pdf", { recursive: true });
      writeFileSync("output/pdf/ai-ink-evidence-sample.pdf", bytes);
    }
    console.log(
      "PASS AI Ink evidence: opt-in privacy, fixed API, abstract reconstruction/scope, bounded reads, unavailable states, source ledger including no-match sources, text-only integrity flags, citation/quote review and offline PDF export.",
    );
  } finally {
    globalThis.fetch = original;
    if (originalTavily === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = originalTavily;
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
