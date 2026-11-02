/** Observable text properties, not a fraud or AI-authorship classifier. */
export function auditIntegrity(raw: string) {
  const flags: Array<{ kind: string; count: number; message: string }> = [];
  const invisible = [...raw.matchAll(/[\u200b\u2060\ufeff]/g)].length;
  const bidi = [...raw.matchAll(/[\u202a-\u202e\u2066-\u2069]/g)].length;
  // ZWJ/ZWNJ are deliberately not flagged: they are legitimate in Indic scripts.
  const mixed = (raw.match(/[\p{L}\p{M}]+/gu) || []).filter(
    (w) => /[a-z]/i.test(w) && /[\u0400-\u052f]/.test(w),
  ).length;
  if (invisible)
    flags.push({
      kind: "invisible-characters",
      count: invisible,
      message:
        "Zero-width characters found. These can come from PDF extraction or formatting; inspect the original document.",
    });
  if (bidi)
    flags.push({
      kind: "direction-controls",
      count: bidi,
      message:
        "Bidirectional text controls found. They can be legitimate in right-to-left text; review display order in the original.",
    });
  if (mixed)
    flags.push({
      kind: "mixed-script-words",
      count: mixed,
      message:
        "Words mix Latin and Cyrillic letters. Check transliteration and extraction before drawing conclusions.",
    });
  return {
    flags,
    method: "unicode-integrity-v1",
    message:
      "These checks detect text properties, not intent, plagiarism or AI authorship. Image pixels, hidden formatting and original page geometry were not inspected.",
  };
}
