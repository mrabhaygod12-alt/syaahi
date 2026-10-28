import assert from "node:assert/strict";
import {
  bibliographyRange,
  referenceEntries,
  quoteRanges,
} from "../lib/ink/sections";
import { auditCitations } from "../lib/ink/citations";
import { matchSources } from "../lib/ink/match";
import { filterMatches, DEFAULT_MATCH_FILTERS } from "../lib/ink/filters";
import { verifyDois } from "../lib/ink/scholarly";
import { reviewPhrasing } from "../lib/ink/phrasing";
import { segment, normalise } from "../lib/ink/text";
async function main() {
  const passage =
    "Machine learning models need a representative training collection and careful evaluation before their findings can support a practical research conclusion.";
  const changed = passage
    .replace("representative", "balanced")
    .replace("practical", "reliable");
  const comparison = [
    {
      id: "near",
      title: "Near source",
      kind: "upload" as const,
      text: passage.repeat(3),
    },
  ];
  const similar = reviewPhrasing(
    changed,
    comparison,
    matchSources(changed, comparison),
  );
  assert.equal(similar.candidates.length, 1);
  assert.equal(
    changed.slice(similar.candidates[0].start, similar.candidates[0].end),
    changed,
  );
  assert.equal(similar.candidates[0].source.text, passage);
  assert.equal(
    reviewPhrasing(passage, comparison, matchSources(passage, comparison))
      .candidates.length,
    0,
    "exact matches do not inflate near-copy count",
  );
  const unrelated =
    "Astronomy measures distant stellar objects using telescopes and spectral observations while historians interpret written records within their cultural setting.";
  assert.equal(
    reviewPhrasing(unrelated, comparison, matchSources(unrelated, comparison))
      .candidates.length,
    0,
  );
  assert.equal(
    reviewPhrasing(
      (changed + "\n\n").repeat(201),
      comparison,
      matchSources(changed, []),
    ).limited,
    true,
    "sentence sampling is disclosed",
  );
  const stress = segment(
    Array.from(
      { length: 5000 },
      (_, i) => `Paragraph ${i} has a complete statement.`,
    ).join("\n\n"),
  );
  assert.equal(stress.paragraphs.length, 5000);
  for (let i = 0; i < stress.paragraphs.length; i++) {
    const p = stress.paragraphs[i];
    assert.equal(stress.sentences[p.sentenceStart].text, p.text);
    assert.equal(p.sentenceEnd - p.sentenceStart, 1);
  }
  const punctuation = normalise(
    "Students’ work—supported by evidence—requires careful reading before reviewers can draw responsible conclusions about its origin and meaning.",
  );
  assert.equal(
    matchSources(punctuation, [
      {
        id: "p",
        title: "Punctuation",
        kind: "upload",
        text: punctuation.replace(/'/g, "’").replace(/-/g, "—").repeat(2),
      },
    ]).coverage,
    1,
  );
  const paper = `Results improved by 20 percent [1, 3]. Smith (2024) reports an improvement. Jones (2022) found a significant reduction. ${passage}\n\nReferences\n[1] Smith, J. (2024). Valid research. doi:10.1234/source-a\n[2] Smith, J. (2024). Valid research. doi:10.1234/source-a\n\nAppendix A\n${passage}`;
  const bib = bibliographyRange(paper)!;
  assert(bib);
  assert(!paper.slice(bib.start, bib.end).includes("Appendix"));
  assert.equal(referenceEntries(paper).length, 2);
  const audit = auditCitations(paper);
  const malformedStart = performance.now();
  auditCitations("a-".repeat(60000));
  assert(
    performance.now() - malformedStart < 3000,
    "hyphenated malformed author input must remain bounded",
  );
  assert(
    audit.issues?.some(
      (i) => i.kind === "missing-reference" && i.text.includes("[3]"),
    ),
  );
  assert(
    audit.issues?.some(
      (i) => i.kind === "missing-reference" && i.text.includes("Jones"),
    ),
  );
  assert(
    !audit.issues?.some(
      (i) => i.kind === "missing-reference" && i.text.includes("Smith"),
    ),
  );
  assert(audit.issues?.some((i) => i.kind === "duplicate-reference"));
  assert(audit.issues?.some((i) => i.kind === "unused-reference"));
  for (const i of audit.issues || [])
    assert(paper.slice(i.start, i.end).length > 0);
  assert.equal(
    bibliographyRange(
      "References\nA table of contents with no reference entries.\n\n" +
        passage.repeat(5),
    ),
    null,
  );
  assert.equal(quoteRanges('An unmatched " quotation ' + passage).length, 0);
  const quoted = `An author said "${passage}". ${passage}\n\nReferences\n[1] Author, A. (2024). ${passage}`;
  const raw = matchSources(quoted, [
    { id: "source", title: "Source", kind: "upload", text: passage.repeat(3) },
  ]);
  assert.equal(
    matchSources(passage, [
      {
        id: "repeat",
        title: "Repeat",
        kind: "upload",
        text: passage.repeat(60),
      },
    ]).limited,
    true,
    "exact-match repetition budgets are disclosed",
  );
  assert(raw.coverage > 0);
  const excluded = filterMatches(quoted, raw, {
    ...DEFAULT_MATCH_FILTERS,
    bibliography: true,
    quotes: true,
  });
  assert(excluded.excludedWords > 0);
  assert(excluded.eligibleWords > 0);
  assert(excluded.match.matchedWords < raw.matchedWords);
  assert(excluded.match.coverage <= 1);
  assert.equal(
    filterMatches(quoted, raw, {
      ...DEFAULT_MATCH_FILTERS,
      excludedSources: ["source"],
    }).match.coverage,
    0,
  );
  assert.equal(
    filterMatches(quoted, raw, { ...DEFAULT_MATCH_FILTERS, minWords: 100 })
      .match.sourceCount,
    0,
  );
  assert.equal(
    filterMatches(quoted, raw, DEFAULT_MATCH_FILTERS).match.matchedWords,
    raw.matchedWords,
  );
  const original = globalThis.fetch;
  let calls = 0;
  process.env.SCOPUS_API_KEY = "fixture-not-sent";
  process.env.SCOPUS_COMMERCIAL_LICENSED = "false";
  globalThis.fetch = async (url, init) => {
    calls++;
    assert(String(url).startsWith("https://api.crossref.org/works/"));
    assert(!new Headers(init?.headers).has("X-ELS-APIKey"));
    return new Response(
      JSON.stringify({
        message: {
          DOI: "10.1234/metadata-found",
          title: ["Verified title"],
          publisher: "Fixture publisher",
          published: { "date-parts": [[2024]] },
        },
      }),
      { headers: { "content-type": "application/json" } },
    );
  };
  try {
    await verifyDois("doi:10.1234/metadata-found", false);
    assert.equal(calls, 0, "no outbound lookup without opt-in");
    const found = await verifyDois("doi:10.1234/metadata-found", true);
    assert.equal(found.records[0].status, "found");
    assert.equal(found.records[0].scopus, "not-configured");
    assert.equal(calls, 1);
    await verifyDois("doi:10.1234/metadata-found", true);
    assert.equal(calls, 1, "metadata cache reused");
    globalThis.fetch = async () => new Response("not found", { status: 404 });
    assert.equal(
      (await verifyDois("doi:10.1234/not-found-fixture", true)).records[0]
        .status,
      "not-found",
    );
    globalThis.fetch = async () => {
      throw Error("provider offline");
    };
    assert.equal(
      (await verifyDois("doi:10.1234/offline-fixture", true)).records[0].status,
      "unavailable",
    );
    globalThis.fetch = async () => new Response("x".repeat(256001));
    assert.equal(
      (await verifyDois("doi:10.1234/large-fixture", true)).records[0].status,
      "unavailable",
    );
    const limited = await verifyDois(
      Array.from({ length: 10 }, (_, i) => `10.1234/limit-${i}`).join(" "),
      true,
    );
    assert.equal(limited.records.length, 8);
    assert.equal(limited.limited, true);
  } finally {
    globalThis.fetch = original;
    delete process.env.SCOPUS_API_KEY;
    delete process.env.SCOPUS_COMMERCIAL_LICENSED;
  }
  console.log(
    "PASS research checks: shared-phrasing evidence/separation/limits, 5,000-paragraph segmentation, normalized punctuation, bibliography boundaries, reference links/missing/duplicates, reversible filters, unclosed quotes, DOI consent, bounded metadata, cache, unavailable vs not-found and licensed Scopus gate. Metadata calls mocked.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
