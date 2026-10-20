import { researchTopic, wikipediaReferences } from "@/lib/research";
import type { DeckSource } from "../drafts";
import type { HybridPlan } from "./model";
/** Bounded multi-hop discovery. Only fixed, public research endpoints are queried. */
export async function researchDossier(
  topic: string,
  supplied: DeckSource[],
  enabled: boolean,
) {
  const sources = [...supplied],
    trace: HybridPlan["research"] = [];
  if (!enabled && sources.length) return { sources, trace };
  const query = topic
    .replace(/https:\/\/\S+/g, "")
    .trim()
    .slice(0, 130);
  if (query.length < 4)
    throw new Error("Add a research topic or import readable sources.");
  const queries = [query, `${query} evidence limitations`.slice(0, 160)];
  for (const q of queries) {
    const found = await researchTopic(q),
      allowed = new Set(wikipediaReferences(found).map((s) => s.url));
    const rows = found.filter((s) => allowed.has(s.url));
    trace.push({
      query: q,
      provider: "Wikipedia public API",
      results: rows.length,
      status: rows.length ? "complete" : "unavailable",
      at: new Date().toISOString(),
    });
    for (const row of rows) {
      if (sources.some((s) => s.locator === row.url) || sources.length >= 10)
        continue;
      sources.push({
        id: `research-${new URL(row.url).pathname.replace(/[^a-z0-9]/gi, "-").slice(-90)}`,
        name: row.title + " (Wikipedia excerpt)",
        kind: "web",
        text: row.excerpt,
        locator: row.url,
        retrievedAt: row.retrievedAt,
        truncated: false,
      });
    }
  }
  // Academic discovery adds independent publication metadata; never pretend abstracts are full papers.
  try {
    const url = new URL("https://api.crossref.org/works");
    url.search = new URLSearchParams({
      query,
      rows: "3",
      select: "DOI,title,publisher,published,abstract,URL",
    }).toString();
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SyaahiResearch/3.0 (https://www.syaahii.in/about)",
      },
      signal: AbortSignal.timeout(7000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Academic discovery unavailable");
    const body = await response.text();
    if (body.length > 300000) throw new Error("Research response too large");
    const items = JSON.parse(body)?.message?.items;
    let added = 0;
    if (Array.isArray(items))
      for (const item of items.slice(0, 3)) {
        if (
          typeof item.abstract !== "string" ||
          typeof item.DOI !== "string" ||
          !/^[a-z0-9./_():;-]{1,180}$/i.test(item.DOI) ||
          sources.length >= 10
        )
          continue;
        const text = item.abstract
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (text.length < 100 || text.length > 10000) continue;
        const id = `doi-${item.DOI.replace(/[^a-z0-9-]/gi, "-")}`;
        if (sources.some((s) => s.id === id)) continue;
        sources.push({
          id,
          name:
            String(item.title?.[0] || item.DOI).slice(0, 160) +
            " (publication abstract)",
          kind: "web",
          text,
          locator: `https://doi.org/${item.DOI}`,
          retrievedAt: new Date().toISOString(),
          truncated: false,
        });
        added++;
      }
    trace.push({
      query,
      provider: "Crossref publication abstracts",
      results: added,
      status: "complete",
      at: new Date().toISOString(),
    });
  } catch {
    trace.push({
      query,
      provider: "Crossref publication abstracts",
      results: 0,
      status: "unavailable",
      at: new Date().toISOString(),
    });
  }
  if (!sources.length)
    throw new Error(
      "Live discovery returned no usable sources. Import a PDF, URL or reference text; no facts were invented.",
    );
  return { sources, trace };
}
