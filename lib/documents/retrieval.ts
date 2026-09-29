export interface DocumentChunk {
  id: string;
  page: number;
  text: string;
}
const words = (text: string): string[] =>
  text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [];

/** Keep physical PDF page boundaries intact so citations are independently verifiable. */
export function chunkPages(
  pages: Array<{ num: number; text: string }>,
): DocumentChunk[] {
  const result: DocumentChunk[] = [];
  for (const page of pages) {
    for (let offset = 0; offset < page.text.length; offset += 1800) {
      const text = page.text.slice(offset, offset + 2000).trim();
      if (text)
        result.push({
          id: `P${page.num}C${Math.floor(offset / 1800) + 1}`,
          page: page.num,
          text,
        });
    }
  }
  if (result.length > 2500)
    throw new Error("Textbook contains too much text. Split it into volumes.");
  return result;
}

/** BM25 lexical retrieval, with length normalization and inverse document frequency. */
export function rankChunks(chunks: DocumentChunk[], query: string, limit = 8) {
  const terms = [...new Set(words(query))].slice(0, 64);
  const tokens = chunks.map((chunk) => words(chunk.text));
  const average =
    tokens.reduce((sum, list) => sum + list.length, 0) / (chunks.length || 1) ||
    1;
  const frequency = new Map(
    terms.map((term) => [
      term,
      tokens.reduce((n, list) => n + Number(list.includes(term)), 0),
    ]),
  );
  return chunks
    .map((chunk, i) => {
      let score = 0;
      for (const term of terms) {
        const tf = tokens[i].filter((word) => word === term).length;
        if (!tf) continue;
        const df = frequency.get(term)!;
        const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5));
        score +=
          (idf * (tf * 2.2)) /
          (tf + 1.2 * (0.25 + (0.75 * tokens[i].length) / average));
      }
      return { ...chunk, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.page - b.page)
    .slice(0, limit);
}

export function evidenceBundle(chunks: DocumentChunk[]) {
  return chunks
    .map(
      (chunk) =>
        `[${chunk.id}] Uploaded document, physical PDF page ${chunk.page}\n${chunk.text}`,
    )
    .join("\n\n");
}
