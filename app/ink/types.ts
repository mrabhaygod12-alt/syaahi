/** Shared client-side shapes for the AI Ink interface. */

export interface InkSignal {
  id: string;
  label: string;
  value: number;
  reading: string;
  why: string;
  weight: number;
}

export interface InkSpan {
  start: number;
  end: number;
  text: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

export interface InkStyle {
  words: number;
  sentences: number;
  paragraphs: number;
  signals: InkSignal[];
  footprint: number;
  band: "clear" | "watch" | "elevated";
  spans: InkSpan[];
  vocabulary: {
    uniqueRatio: number;
    averageWordLength: number;
    longWordRatio: number;
  };
  sentenceStats: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    shortRatio: number;
    longRatio: number;
  };
}

export interface InkSourceDoc {
  id: string;
  title: string;
  url?: string;
  kind: "web" | "upload" | "corpus";
  text: string;
  retrievedAt?: string;
}

export interface InkMatchedSpan {
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  words: number;
  text: string;
  sourceText: string;
}

export interface InkSourceMatch {
  source: InkSourceDoc;
  spans: InkMatchedSpan[];
  matchedWords: number;
  coverage: number;
  longestRun: number;
}

export interface InkMatch {
  limited?: boolean;
  sources: InkSourceMatch[];
  matchedWords: number;
  coverage: number;
  sourceCount: number;
}

export interface InkCitation {
  references?: Array<{
    id: string;
    text: string;
    start: number;
    end: number;
    number?: number;
    author?: string;
    year?: string;
    dois: string[];
  }>;
  issues?: Array<{ kind: string; text: string; start: number; end: number }>;
  uncited: Array<{ start: number; end: number; text: string; reason: string }>;
  cited: number;
  totalClaims: number;
  score: number;
}

export interface InkSearch {
  provider: "tavily" | "brave" | "none";
  queries: number;
  results: number;
  status: "complete" | "skipped" | "unavailable" | "partial";
  message: string;
}

export interface InkReport {
  phrasing?: {
    candidates: Array<{
      start: number;
      end: number;
      text: string;
      source: { id: string; title: string; url?: string; text: string };
      reason: string;
    }>;
    comparisons: number;
    limited: boolean;
    method: string;
  };
  id: string;
  owner: string;
  kind: string;
  updatedAt: string;
  createdAt: string;
  title: string;
  text: string;
  words: number;
  characters: number;
  comparedSources: number;
  style: InkStyle;
  match: InkMatch;
  citations: InkCitation;
  scholarly?: {
    enabled: boolean;
    provider: string;
    totalDois: number;
    limited: boolean;
    message: string;
    records: Array<{
      doi: string;
      status: string;
      title?: string;
      year?: number;
      publisher?: string;
      scopus: string;
    }>;
  };
  index?: {
    indexed: number;
    candidates: number;
    compared: number;
    limited: boolean;
  };
  search: InkSearch;
  checks: {
    web: boolean;
    uploads: boolean;
    corpus: boolean;
    citations: boolean;
  };
}

export interface InkSummary {
  id: string;
  title: string;
  words: number;
  footprint: number;
  band: InkStyle["band"];
  matched: number;
  sources: number;
  citations: number;
  createdAt: string;
  search: InkSearch["status"];
}
