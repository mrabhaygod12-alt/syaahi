export interface HistTurn {
  q: string;
  a: string;
}

// Keyword-overlap rank: grounds big lessons in the most relevant pages
// instead of a blind char slice (cuts wrong-answer rate on 10+ pagers).
// Shared by /api/ask and /api/ask-stream (route modules must not export
// helpers: Next.js route-type checks reject them).
export function rankPages(
  pages: Array<{ topic: string; markdown: string }>,
  question: string,
  history: HistTurn[],
): number[] {
  const stop = new Set(
    "about after again all also an and any are as at be because before between but by can could did do does for from get give had has have how i if in into is it its just me more my of on one or our please show so some than that the their them then there these they this through to up use using was we were what when where which who why will with would you your explain lesson notes page pages this idea simply example work worked compare related understand question answer".split(
      " ",
    ),
  );
  const toks = (value: string) =>
    (value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(
      (word) => word.length > 2 && !stop.has(word),
    );
  const query = [
    ...toks(question),
    ...history.slice(-2).flatMap((turn) => toks(turn.q.slice(0, 300))),
  ];
  const qset = new Set(query);
  if (!qset.size) return pages.map((_, i) => i).slice(0, 3);
  const indexed = pages.map((page) => {
    const body = page.markdown.slice(0, 12000),
      titleWords = toks(page.topic),
      bodyWords = toks(body),
      headingText = body
        .split("\n")
        .filter((line) => /^\s{0,3}#{1,6}\s/.test(line))
        .join(" "),
      headingWords = toks(headingText),
      counts = new Map<string, number>();
    for (const word of bodyWords) counts.set(word, (counts.get(word) || 0) + 1);
    return {
      titleWords: new Set(titleWords),
      headingWords: new Set(headingWords),
      counts,
      normalized: `${page.topic}\n${body}`
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim(),
    };
  });
  const documentFrequency = new Map<string, number>();
  for (const term of qset) {
    documentFrequency.set(
      term,
      indexed.reduce(
        (count, page) =>
          count +
          Number(
            page.titleWords.has(term) ||
              page.headingWords.has(term) ||
              page.counts.has(term),
          ),
        0,
      ),
    );
  }
  const phrase = toks(question).join(" ");
  const scored = indexed.map((page, i) => {
    let score = 0;
    for (const term of qset) {
      const idf = Math.log(
        1 + (pages.length + 1) / (1 + (documentFrequency.get(term) || 0)),
      );
      const frequency = page.counts.get(term) || 0;
      if (frequency) score += idf * (1 + Math.log(frequency));
      if (page.headingWords.has(term)) score += 1.5 * idf;
      if (page.titleWords.has(term)) score += 3 * idf;
    }
    if (phrase.length > 5 && page.normalized.includes(phrase)) score += 5;
    return { i, score };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  const ranked = scored.filter((x) => x.score > 0).map((x) => x.i);
  const fallback = pages.map((_, i) => i).filter((i) => !ranked.includes(i));
  return [...ranked, ...fallback].slice(0, 3);
}
