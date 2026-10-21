import { analyseStyle, type StyleReport } from "./style";
import { matchSources, searchExcerpts, type MatchReport, type SourceDocument } from "./match";
import { discoverSources, searchConfigured, type SearchTrace } from "./search";
import { auditCitations, type CitationCoverage } from "./citations";
import { segment } from "./text";

/**
 * The analysis core: pure functions over text, with no storage or auth
 * coupling. `lib/ink/store.ts` wraps this with persistence; keeping them apart
 * means the engine can be exercised without a database.
 */

export interface InkAnalysis {
  /** Normalised submission text, so spans can be highlighted later. */
  text: string;
  words: number;
  characters: number;
  comparedSources: number;
  style: StyleReport;
  match: MatchReport;
  citations: CitationCoverage;
  search: SearchTrace;
  checks: {
    web: boolean;
    uploads: boolean;
    corpus: boolean;
    citations: boolean;
  };
}

export const MAX_CHARS = 120000;

export interface AnalyseInput {
  text: string;
  /** Sources the learner uploaded or the caller already retrieved. */
  sources?: SourceDocument[];
  /** Disable web discovery for a fast, offline-only pass. */
  allowWeb?: boolean;
}

export async function analyse(input: AnalyseInput): Promise<InkAnalysis> {
  const raw = input.text.trim();
  if (raw.length < 200)
    throw new Error(
      "Paste at least a paragraph (about 200 characters) to analyse.",
    );
  if (raw.length > MAX_CHARS)
    throw new Error(
      `Analyse up to ${MAX_CHARS.toLocaleString()} characters at a time. Split longer documents into chapters or sections.`,
    );

  const doc = segment(raw);
  const style = analyseStyle(raw);
  const citations = auditCitations(raw);

  const allowWeb = input.allowWeb === true;
  let webSources: SourceDocument[] = [];
  let search: SearchTrace = {
    provider: "none",
    queries: 0,
    results: 0,
    status: "skipped",
    message: "Web matching was turned off for this run.",
  };

  if (allowWeb && searchConfigured()) {
    const discovery = await discoverSources(searchExcerpts(doc.text, 6));
    webSources = discovery.sources;
    search = discovery.trace;
  } else if (allowWeb) {
    // No provider configured: report that honestly rather than implying a search.
    search = {
      provider: "none",
      queries: 0,
      results: 0,
      status: "skipped",
      message:
        "Web matching is not configured on this server, so only your uploaded sources were compared.",
    };
  }

  const supplied = input.sources || [];
  const match = matchSources(doc.text, [...supplied, ...webSources]);
  // Retain only the evidence excerpts, not entire third-party pages in every report.
  match.sources = match.sources.map(row => ({ ...row, source: { ...row.source, text: "" } }));

  return {
    text: doc.text,
    words: doc.words,
    characters: doc.characters,
    comparedSources: supplied.length + webSources.length,
    style,
    match,
    citations,
    search,
    checks: {
      web: search.status === "complete" || search.status === "partial",
      uploads: supplied.some((s) => s.kind === "upload"),
      corpus: supplied.some((s) => s.kind === "corpus"),
      citations: true,
    },
  };
}
