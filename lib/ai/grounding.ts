export interface HistTurn {
  q: string;
  a: string;
}

// Keyword-overlap rank: grounds big lessons in the most relevant pages
// instead of a blind char slice (cuts wrong-answer rate on 10+ pagers).
// Shared by /api/ask and /api/ask-stream (route modules must not export
// helpers — Next.js route-type checks reject them).
export function rankPages(
  pages: Array<{ topic: string; markdown: string }>,
  question: string,
  history: HistTurn[],
): number[] {
  const toks = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\u0900-\u097f0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);
  const qset = new Set([
    ...toks(question),
    ...history.flatMap((h) => toks(`${h.q} ${h.a}`.slice(0, 400))),
  ]);
  if (!qset.size) return pages.map((_, i) => i).slice(0, 3);
  const scored = pages.map((p, i) => {
    const words = new Set(toks(`${p.topic} ${p.markdown.slice(0, 1500)}`));
    let s = 0;
    for (const w of qset) if (words.has(w)) s++;
    // Topic-title hits weigh double — the question usually names the page.
    for (const w of qset) if (p.topic.toLowerCase().includes(w)) s += 2;
    return { i, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const ranked = scored.filter((x) => x.s > 0).map((x) => x.i);
  const fallback = pages.map((_, i) => i).filter((i) => !ranked.includes(i));
  return [...ranked, ...fallback].slice(0, 3);
}
