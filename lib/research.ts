export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  retrievedAt: string;
}
export interface ReadingLink {
  title: string;
  url: string;
  kind: "source" | "search";
}

const GFG_TOPIC =
  /\b(computer|program(?:ming)?|software|algorithms?|data structures?|databases?|python|javascript|typescript|java|c\+\+|web development|cyber ?security|networks?|machine learning|artificial intelligence|operating systems?|cloud|html|css|sql)\b/i;
const W3_TOPIC =
  /\b(web|html|css|javascript|typescript|python|java|sql|php|bootstrap|react|node(?:\.js)?|program(?:ming)?|api|dom|frontend|front-end|backend|back-end)\b/i;

/**
 * User-clicked, site-scoped reading searches. These are intentionally links,
 * not automated content retrieval: GeeksforGeeks and W3Schools prohibit
 * scraping/automated extraction in their published terms.
 */
export function topicReadingLinks(topic: string): ReadingLink[] {
  const query = topic.trim().replace(/\s+/g, " ").slice(0, 180);
  if (!query) return [];
  const search = (site: string) => {
    const url = new URL("https://www.google.com/search");
    url.searchParams.set("q", `site:${site} ${query}`);
    return url.href;
  };
  const links: ReadingLink[] = [];
  if (GFG_TOPIC.test(query))
    links.push({
      title: "Search GeeksforGeeks",
      url: search("geeksforgeeks.org"),
      kind: "search",
    });
  if (W3_TOPIC.test(query))
    links.push({
      title: "Search W3Schools",
      url: search("w3schools.com"),
      kind: "search",
    });
  return links;
}

/** Accept only actual Wikipedia article links returned by the research step. */
export function wikipediaReferences(value: unknown): ReadingLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 4)
    .flatMap((item, i) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as { title?: unknown; url?: unknown };
      if (typeof candidate.url !== "string") return [];
      try {
        const url = new URL(candidate.url);
        if (
          url.protocol !== "https:" ||
          url.hostname !== "en.wikipedia.org" ||
          !url.pathname.startsWith("/wiki/")
        )
          return [];
        return [
          {
            title:
              typeof candidate.title === "string"
                ? candidate.title.slice(0, 160)
                : `Wikipedia source ${i + 1}`,
            url: url.href,
            kind: "source" as const,
          },
        ];
      } catch {
        return [];
      }
    });
}

// Public, fixed-domain retrieval. Never turn arbitrary model output into a URL fetch.
export async function researchTopic(topic: string): Promise<ResearchSource[]> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: topic.slice(0, 160),
    gsrlimit: "2",
    prop: "extracts|info",
    explaintext: "1",
    exchars: "10000",
    inprop: "url",
    redirects: "1",
  }).toString();
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SyaahiStudy/0.2 (educational source retrieval)",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data.query?.pages || {})
      .filter((p: any) => p.extract?.length > 100)
      .map((p: any, i) => ({
        id: `S${i + 1}`,
        title: String(p.title),
        url: String(p.fullurl),
        excerpt: String(p.extract).slice(0, 10000),
        retrievedAt: new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}
export function relevantSource(
  context: string,
  topic: string,
  budget = 12000,
): string {
  if (context.length <= budget) return context;
  const terms = new Set(topic.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
  const chunks = context.match(/[\s\S]{1,1800}/g) || [context];
  const ranked = chunks
    .map((text, index) => ({
      text,
      index,
      score: [...terms].reduce(
        (n, t) => n + (text.toLowerCase().includes(t) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score);
  const selected: typeof ranked = [];
  let used = 0;
  for (const chunk of ranked) {
    if (used + chunk.text.length > budget) continue;
    selected.push(chunk);
    used += chunk.text.length;
  }
  return selected
    .sort((a, b) => a.index - b.index)
    .map((c) => c.text)
    .join("\n\n");
}
