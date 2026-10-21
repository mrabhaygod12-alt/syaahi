import { createHash } from "node:crypto";
import type { SourceDocument } from "./match";

/**
 * Web discovery for the AI Ink matcher.
 *
 * Every provider here is optional. When no key is configured the engine still
 * runs against the learner's own uploads and the open corpora — it simply
 * reports that web matching was skipped rather than pretending it searched.
 * Never invent a "not found" result for a search that did not happen.
 */

export type SearchProvider = "tavily" | "brave" | "none";

export interface SearchTrace {
  provider: SearchProvider;
  queries: number;
  results: number;
  status: "complete" | "skipped" | "unavailable" | "partial";
  message: string;
}

export interface DiscoveryResult {
  sources: SourceDocument[];
  trace: SearchTrace;
}

const HOST = {
  tavily: "https://api.tavily.com/search",
  brave: "https://api.search.brave.com/res/v1/web/search",
} as const;

export function searchProvider(): SearchProvider {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.BRAVE_SEARCH_API_KEY) return "brave";
  return "none";
}

export function searchConfigured(): boolean {
  return searchProvider() !== "none";
}

/** Only ever follow public http(s) results; reject anything else outright. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".local"))
      return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Strip tags and collapse whitespace from a search snippet. */
function plain(value: unknown, max = 12000): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]{0,400}>/g, " ")
    .replace(/&[a-z]{2,8};/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

async function tavily(query: string, key: string, signal: AbortSignal): Promise<SourceDocument[]> {
  const response = await fetch(HOST.tavily, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query: query.slice(0, 380),
      search_depth: "advanced",
      // Raw page text is what actually lets us match a passage, not the snippet.
      include_raw_content: true,
      max_results: 5,
    }),
    signal,
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Tavily responded ${response.status}`);
  const data = (await readSearchJson(response)) as {
    results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string }>;
  };
  return (data.results || [])
    .map((row): SourceDocument | null => {
      const url = safeUrl(row.url);
      if (!url) return null;
      // Prefer the full page body; fall back to the snippet, which is still
      // enough to confirm a verbatim run of words.
      const text = plain(row.raw_content, 40000) || plain(row.content, 8000);
      if (text.length < 200) return null;
      return {
        id: `web-${createHash("sha256").update(url).digest("hex").slice(0, 20)}`,
        title: plain(row.title, 200) || url,
        url,
        kind: "web",
        text,
        retrievedAt: new Date().toISOString(),
      };
    })
    .filter((x): x is SourceDocument => x !== null);
}

async function brave(query: string, key: string, signal: AbortSignal): Promise<SourceDocument[]> {
  const url = new URL(HOST.brave);
  url.searchParams.set("q", query.slice(0, 380));
  url.searchParams.set("count", "5");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
    },
    signal,
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Brave responded ${response.status}`);
  const data = (await readSearchJson(response)) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string; extra_snippets?: string[] }> };
  };
  return (data.web?.results || [])
    .map((row): SourceDocument | null => {
      const href = safeUrl(row.url);
      if (!href) return null;
      // Brave's free tier returns snippets only. Joining description and
      // extra_snippets gives enough contiguous prose to confirm short runs.
      const text = plain(
        [row.description, ...(row.extra_snippets || [])].filter(Boolean).join(" "),
        8000,
      );
      if (text.length < 200) return null;
      return {
        id: `web-${createHash("sha256").update(href).digest("hex").slice(0, 20)}`,
        title: plain(row.title, 200) || href,
        url: href,
        kind: "web",
        text,
        retrievedAt: new Date().toISOString(),
      };
    })
    .filter((x): x is SourceDocument => x !== null);
}

/**
 * Run the excerpts against the configured provider. Failures degrade to a
 * trace the UI can show honestly, never to a silent empty result.
 */
export async function discoverSources(
  excerpts: string[],
  options: { maxQueries?: number } = {},
): Promise<DiscoveryResult> {
  const provider = searchProvider();
  if (provider === "none")
    return {
      sources: [],
      trace: {
        provider: "none",
        queries: 0,
        results: 0,
        status: "skipped",
        message:
          "Web matching is not configured. Add TAVILY_API_KEY on the server to compare against live web sources.",
      },
    };

  const key =
    provider === "tavily"
      ? process.env.TAVILY_API_KEY!
      : process.env.BRAVE_SEARCH_API_KEY!;
  const queries = excerpts.slice(0, Math.max(1, Math.min(10, options.maxQueries ?? 6)));

  const found: SourceDocument[] = [];
  let failures = 0;
  const signal = AbortSignal.timeout(15000);
  for (let offset = 0; offset < queries.length; offset += 2) {
    await Promise.all(queries.slice(offset, offset + 2).map(async query => {
    try {
      const rows =
        provider === "tavily" ? await tavily(query, key, signal) : await brave(query, key, signal);
      found.push(...rows);
    } catch {
      failures += 1;
    }
    }));
  }

  // De-duplicate by URL, keeping the longest retrieved text.
  const byUrl = new Map<string, SourceDocument>();
  for (const doc of found) {
    const existing = byUrl.get(doc.url || doc.id);
    if (!existing || doc.text.length > existing.text.length)
      byUrl.set(doc.url || doc.id, doc);
  }
  const sources = [...byUrl.values()].slice(0, 24);

  const status: SearchTrace["status"] =
    failures === 0 ? "complete" : failures >= queries.length ? "unavailable" : "partial";

  return {
    sources,
    trace: {
      provider,
      queries: queries.length,
      results: sources.length,
      status,
      message:
        status === "complete"
          ? `Compared against ${sources.length} live web source${sources.length === 1 ? "" : "s"}.`
          : status === "partial"
            ? `Compared against ${sources.length} sources; ${failures} search request${failures === 1 ? "" : "s"} failed.`
            : "The search provider could not be reached, so web matching was skipped for this run.",
    },
  };
}

async function readSearchJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty search response");
  const parts: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.length; if (bytes > 1500000) throw new Error("Search response too large");
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
}
