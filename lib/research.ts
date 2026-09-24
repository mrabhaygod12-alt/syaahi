export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  retrievedAt: string;
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
      signal: AbortSignal.timeout(10000),
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
