import { createHash } from "node:crypto";
import type { SourceDocument } from "./match";
import { searchExcerpts } from "./match";

export interface ResearchTrace {
  provider: string;
  status:
    | "compared"
    | "partial"
    | "unavailable"
    | "not-configured"
    | "not-requested"
    | "manual-only";
  discovered: number;
  compared: number;
  message: string;
}
export interface SourceEvidence {
  id: string;
  title: string;
  url?: string;
  kind: SourceDocument["kind"];
  provider: string;
  scope: NonNullable<SourceDocument["scope"]>;
  retrievedAt?: string;
  sha256: string;
  characters: number;
  truncated: boolean;
  matchedWords: number;
}

/** Bounded JSON reads; a fixed API endpoint is never replaced with a result URL. */
export async function researchJson(response: Response): Promise<any> {
  if (!response.ok) throw new Error("Research service unavailable.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty research response.");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1_000_000) throw new Error("Research response limit reached.");
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** OpenAlex supplies bibliographic metadata and some abstracts, not publisher full text. */
export function openAlexSources(rows: unknown): SourceDocument[] {
  if (!Array.isArray(rows)) return [];
  const out: SourceDocument[] = [];
  for (const row of rows.slice(0, 5)) {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      !/^https:\/\/openalex\.org\/W\d+$/.test(row.id)
    )
      continue;
    const positions = new Map<number, string>();
    const inverted = row.abstract_inverted_index as
      Record<string, unknown> | undefined;
    for (const [word, indices] of Object.entries(inverted || {}).slice(
      0,
      5000,
    )) {
      if (!Array.isArray(indices) || word.length > 150) continue;
      for (const i of indices.slice(0, 1000))
        if (Number.isInteger(i) && i >= 0 && i < 6000) positions.set(i, word);
    }
    const text = [...positions]
      .sort((a, b) => a[0] - b[0])
      .map(([, w]) => w)
      .join(" ")
      .slice(0, 30000);
    if (text.length < 200) continue;
    out.push({
      id: "openalex-" + row.id.split("/").pop(),
      title: String(row.title || "Research abstract").slice(0, 250),
      url: row.id,
      text,
      kind: "web",
      scope: "abstract",
      provider: "OpenAlex",
      retrievedAt: new Date().toISOString(),
      truncated: positions.size >= 6000 || text.length >= 30000,
    });
  }
  return out;
}

export async function discoverResearch(
  text: string,
  enabled: boolean,
  signal?: AbortSignal,
): Promise<{ sources: SourceDocument[]; trace: ResearchTrace }> {
  if (!enabled)
    return {
      sources: [],
      trace: {
        provider: "OpenAlex",
        status: "not-requested",
        discovered: 0,
        compared: 0,
        message: "Research discovery was turned off. No excerpts were sent.",
      },
    };
  const sources = new Map<string, SourceDocument>();
  let successes = 0,
    discovered = 0;
  const queries = searchExcerpts(text, 2);
  await Promise.all(
    queries.map(async (q) => {
      try {
        const url = new URL("https://api.openalex.org/works");
        url.searchParams.set("search", q.slice(0, 280));
        url.searchParams.set("per-page", "5");
        url.searchParams.set("select", "id,title,abstract_inverted_index");
        const data = await researchJson(
          await fetch(url, {
            signal: signal
              ? AbortSignal.any([signal, AbortSignal.timeout(9000)])
              : AbortSignal.timeout(9000),
            redirect: "error",
            headers: { Accept: "application/json" },
          }),
        );
        if (!Array.isArray(data.results))
          throw new Error("Unexpected research response.");
        successes++;
        discovered += data.results.length;
        for (const s of openAlexSources(data.results)) sources.set(s.id, s);
      } catch {
        /* An unavailable service is never reported as a clean search. */
      }
    }),
  );
  return {
    sources: [...sources.values()].slice(0, 10),
    trace: {
      provider: "OpenAlex",
      status:
        successes === queries.length && successes
          ? "compared"
          : successes
            ? "partial"
            : "unavailable",
      discovered,
      compared: sources.size,
      message: successes
        ? "Compared available research abstracts. Records without readable abstracts were not text-compared; publisher full text was not accessed."
        : "Research discovery could not complete. No OpenAlex text was compared.",
    },
  };
}

export function sourceEvidence(
  source: SourceDocument,
  matchedWords: number,
): SourceEvidence {
  const text = source.text.slice(0, 60000);
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    kind: source.kind,
    provider:
      source.provider ||
      (source.kind === "web"
        ? "Web search"
        : source.kind === "corpus"
          ? "Private index"
          : "Your supplied reference"),
    scope:
      source.scope || (source.kind === "web" ? "snippet" : "supplied-text"),
    retrievedAt: source.retrievedAt,
    sha256: createHash("sha256").update(text).digest("hex"),
    characters: text.length,
    truncated: source.truncated === true || source.text.length > 60000,
    matchedWords,
  };
}

export function externalCoverage(): ResearchTrace[] {
  return [
    {
      provider: "Google Scholar",
      status: "manual-only",
      discovered: 0,
      compared: 0,
      message:
        "Manual lookup only. Google Scholar is not automatically scraped or text-compared.",
    },
    {
      provider: "ScienceDirect",
      status: "not-configured",
      discovered: 0,
      compared: 0,
      message:
        "Licensed publisher full-text access is not configured. Public metadata or an abstract is not a full-paper comparison.",
    },
    {
      provider: "Scopus full text",
      status: "not-configured",
      discovered: 0,
      compared: 0,
      message:
        "Scopus is a bibliographic index, not a full-text similarity database. Optional DOI metadata verification is reported separately.",
    },
    {
      provider: "AI text detection",
      status: "not-configured",
      discovered: 0,
      compared: 0,
      message:
        "No validated AI-authorship detector is connected. No AI-writing probability was calculated.",
    },
    {
      provider: "AI image and graph detection",
      status: "not-configured",
      discovered: 0,
      compared: 0,
      message:
        "Figures, graphs and image origins were not assessed. Text extraction and similarity do not establish whether an image is AI-generated.",
    },
  ];
}
