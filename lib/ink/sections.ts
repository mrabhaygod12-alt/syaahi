/** Conservative, bounded section/quote parsing. Offsets always refer to the original text. */
export interface TextRange {
  start: number;
  end: number;
}
export interface ReferenceEntry extends TextRange {
  id: string;
  text: string;
  number?: number;
  author?: string;
  year?: string;
  dois: string[];
}
export function bibliographyRange(text: string): TextRange | null {
  const headings = [
    ...text.matchAll(
      /^(?:#{1,3}\s*)?(?:\d+[.\s]+)?(?:references|bibliography|works cited|reference list)\s*:?[ \t]*$/gim,
    ),
  ];
  for (const h of headings.reverse()) {
    const start = h.index!;
    if (start < text.length * 0.15) continue;
    const after = start + h[0].length;
    const tail = text.slice(after);
    if (!/(?:19|20)\d{2}|10\.\d{4,9}\/|^\s*\[1\]/m.test(tail.slice(0, 1000)))
      continue;
    const stop =
      /^(?:#{1,3}\s*)?(?:appendix|appendices|acknowledg(?:e)?ments|supplementary material)\b.*$/im.exec(
        tail,
      );
    return { start, end: stop ? after + stop.index : text.length };
  }
  return null;
}
export function doiStrings(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\b10\.\d{4,9}\/[^\s<>"“”]+/gi)) {
    let d = m[0].replace(/[.,;:]+$/, "");
    while (
      d.endsWith(")") &&
      (d.match(/\)/g) || []).length > (d.match(/\(/g) || []).length
    )
      d = d.slice(0, -1);
    if (d.length <= 256) found.add(d.toLowerCase());
    if (found.size >= 100) break;
  }
  return [...found];
}
export function referenceEntries(text: string): ReferenceEntry[] {
  const range = bibliographyRange(text);
  if (!range) return [];
  const body = text.slice(range.start, range.end),
    lines = [...body.matchAll(/^.*$/gm)];
  const out: ReferenceEntry[] = [];
  for (const line of lines.slice(1)) {
    const raw = line[0].trim();
    if (!raw) continue;
    const numbered = /^(?:\[(\d{1,4})\]|(\d{1,4})[.)])\s*/.exec(raw);
    const begins =
      !!numbered ||
      /^[\p{L}][\p{L}'’ -]{1,60},.{0,60}(?:19|20)\d{2}/u.test(raw);
    if ((begins || !out.length) && out.length < 100) {
      const clean = raw.replace(/^(?:\[\d+\]|\d+[.)])\s*/, "");
      out.push({
        id: `ref-${out.length + 1}`,
        text: raw,
        start: range.start + line.index!,
        end: range.start + line.index! + line[0].length,
        number: numbered ? Number(numbered[1] || numbered[2]) : undefined,
        author: /^([\p{L}][\p{L}'’-]*)/u.exec(clean)?.[1]?.toLocaleLowerCase(),
        year: /\b((?:19|20)\d{2}[a-z]?)\b/.exec(raw)?.[1],
        dois: doiStrings(raw),
      });
    } else if (out.length) {
      const prev = out[out.length - 1];
      prev.text = (prev.text + " " + raw).slice(0, 4000);
      prev.end = range.start + line.index! + line[0].length;
      prev.dois = doiStrings(prev.text);
    }
  }
  return out;
}
export function quoteRanges(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  // A missing close quote never excludes the remainder of the paper.
  for (const pattern of [
    /“[^“”]{8,2000}”/g,
    /"[^"\n]{8,2000}"/g,
    /«[^«»]{8,2000}»/g,
  ])
    for (const m of text.matchAll(pattern)) {
      ranges.push({ start: m.index!, end: m.index! + m[0].length });
      if (ranges.length >= 500) return ranges;
    }
  return ranges;
}
