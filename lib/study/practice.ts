export interface PracticeSource {
  /** Zero-based index into the saved lesson, never an external AI-created URL. */
  page: number;
  topic: string;
}
export interface PracticeSettings {
  size: number;
  cardCount: number;
  format: "mcq" | "blank" | "short" | "mixed";
  difficulty: "foundation" | "standard" | "challenge";
  focus: string;
}

export function practiceSettings(
  input: Record<string, unknown>,
  pageCount: number,
): PracticeSettings {
  const count = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isInteger(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  return {
    size: count(input.size, Math.min(30, Math.max(8, pageCount * 3)), 5, 30),
    cardCount: count(
      input.cardCount,
      Math.min(36, Math.max(6, pageCount * 3)),
      6,
      36,
    ),
    format: ["mcq", "blank", "short", "mixed"].includes(String(input.format))
      ? (input.format as PracticeSettings["format"])
      : "mixed",
    difficulty: ["foundation", "standard", "challenge"].includes(
      String(input.difficulty),
    )
      ? (input.difficulty as PracticeSettings["difficulty"])
      : "standard",
    focus:
      typeof input.focus === "string" ? input.focus.trim().slice(0, 160) : "",
  };
}

/** Model references can identify supplied sections, but cannot invent sources. */
export function practiceSources(
  value: unknown,
  pages: Array<{ topic: string }>,
): PracticeSource[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (page): page is number =>
          Number.isInteger(page) && page >= 0 && page < pages.length,
      ),
    ),
  ]
    .slice(0, 3)
    .map((page) => ({ page, topic: pages[page].topic.slice(0, 160) }));
}
