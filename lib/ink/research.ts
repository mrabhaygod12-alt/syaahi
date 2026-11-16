import { createHash } from "node:crypto";
import type { SourceDocument } from "./match";
import { searchExcerpts } from "./match";
import { load } from "cheerio";

class ResearchServiceError extends Error {
  constructor(public code: string) {
    super("Research service unavailable.");
  }
}
let crossrefBusy = false,
  crossrefNext = 0;
async function crossrefLookup(url: URL, signal?: AbortSignal) {
  if (crossrefBusy || crossrefNext > Date.now() + 1500)
    throw new ResearchServiceError("capacity busy; retry later");
  crossrefBusy = true;
  try {
    const wait = Math.max(0, crossrefNext - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    signal?.throwIfAborted();
    crossrefNext = Date.now() + 1100;
    const response = await fetch(url, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
      redirect: "error",
      headers: {
        Accept: "application/json",
        "User-Agent": "SyaahiiResearch/1.0 (+https://www.syaahii.in/ai-ink)",
      },
    });
    if (response.status === 429)
      crossrefNext =
        Date.now() +
        Math.min(
          60000,
          Math.max(
            1100,
            Number(response.headers.get("retry-after") || 10) * 1000 || 10000,
          ),
        );
    return await researchJson(response);
  } finally {
    crossrefBusy = false;
  }
}

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
  if (!response.ok) throw new ResearchServiceError(`HTTP ${response.status}`);
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

export function crossrefSources(rows: unknown): SourceDocument[] {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 5).flatMap((row) => {
    if (
      !row ||
      typeof row.DOI !== "string" ||
      !/^10\.\d{4,9}\/\S{1,240}$/i.test(row.DOI) ||
      typeof row.abstract !== "string"
    )
      return [];
    const $ = load(row.abstract.slice(0, 60000));
    $("script,style").remove();
    const text = $.text().replace(/\s+/g, " ").trim().slice(0, 30000);
    if (text.length < 200) return [];
    const doi = row.DOI.toLowerCase();
    return [
      {
        id:
          "crossref-" +
          createHash("sha256").update(doi).digest("hex").slice(0, 24),
        title:
          Array.isArray(row.title) && typeof row.title[0] === "string"
            ? row.title[0].slice(0, 250)
            : doi,
        url: "https://doi.org/" + encodeURIComponent(doi),
        text,
        kind: "web" as const,
        scope: "abstract" as const,
        provider: "Crossref abstracts",
        retrievedAt: new Date().toISOString(),
        truncated: text.length >= 30000,
      },
    ];
  });
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
        provider: "Research discovery",
        status: "not-requested",
        discovered: 0,
        compared: 0,
        message: "Research discovery was turned off. No excerpts were sent.",
      },
    };
  const sources = new Map<string, SourceDocument>();
  let successes = 0,
    discovered = 0,
    fallbackSuccesses = 0,
    fallbackUsed = false;
  const failures = new Set<string>();
  const queries = searchExcerpts(text, 2);
  await Promise.all(
    queries.map(async (q) => {
      try {
        const url = new URL("https://api.openalex.org/works");
        url.searchParams.set("search", q.slice(0, 280));
        url.searchParams.set("per-page", "5");
        url.searchParams.set("select", "id,title,abstract_inverted_index");
        if (process.env.OPENALEX_API_KEY)
          url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
        const data = await researchJson(
          await fetch(url, {
            signal: signal
              ? AbortSignal.any([signal, AbortSignal.timeout(9000)])
              : AbortSignal.timeout(9000),
            redirect: "error",
            headers: {
              Accept: "application/json",
              "User-Agent":
                "SyaahiiResearch/1.0 (+https://www.syaahii.in/ai-ink)",
            },
          }),
        );
        if (!Array.isArray(data.results))
          throw new Error("Unexpected research response.");
        successes++;
        discovered += data.results.length;
        for (const s of openAlexSources(data.results)) sources.set(s.id, s);
      } catch (e) {
        failures.add(
          e instanceof ResearchServiceError
            ? e.code
            : e instanceof Error && /timeout|abort/i.test(e.name)
              ? "timeout"
              : "network or response failure",
        );
      }
    }),
  );
  if (queries.length && (sources.size === 0 || successes < queries.length)) {
    fallbackUsed = true;
    for (const q of queries) {
      try {
        const url = new URL("https://api.crossref.org/works");
        url.searchParams.set("query.bibliographic", q.slice(0, 280));
        url.searchParams.set("rows", "5");
        url.searchParams.set("filter", "has-abstract:true");
        url.searchParams.set("select", "DOI,title,abstract,URL");
        const data = await crossrefLookup(url, signal);
        if (!Array.isArray(data.message?.items))
          throw Error("Unexpected metadata response.");
        fallbackSuccesses++;
        discovered += data.message.items.length;
        for (const s of crossrefSources(data.message.items))
          sources.set(s.id, s);
      } catch (e) {
        failures.add(
          "Crossref " +
            (e instanceof ResearchServiceError
              ? e.code
              : e instanceof Error && /timeout|abort/i.test(e.name)
                ? "timeout"
                : "network or response failure"),
        );
      }
    }
  }
  const compared = [...sources.values()].slice(0, 10);
  return {
    sources: compared,
    trace: {
      provider: fallbackUsed ? "OpenAlex + Crossref" : "OpenAlex",
      status:
        successes === queries.length &&
        successes &&
        (!fallbackUsed || fallbackSuccesses === queries.length)
          ? "compared"
          : successes || fallbackSuccesses
            ? "partial"
            : "unavailable",
      discovered,
      compared: compared.length,
      message:
        (successes || fallbackSuccesses
          ? "Compared available research abstracts. Records without readable abstracts were not text-compared; publisher full text was not accessed."
          : "Research discovery could not complete. No research abstract text was compared.") +
        (failures.size
          ? " Provider availability: " + [...failures].join("; ") + "."
          : "") +
        (fallbackUsed ? " Crossref abstract fallback was attempted." : ""),
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
