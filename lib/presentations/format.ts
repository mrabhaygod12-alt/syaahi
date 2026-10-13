export type DeckFormat = "detailed" | "presenter";

/** Old decks used presenter-style slots without a saved reading mode. */
export function deckFormat(value: unknown): DeckFormat {
  return value === "detailed" ? "detailed" : "presenter";
}

export function formatInstructions(value: unknown): string {
  return deckFormat(value) === "detailed"
    ? "Detailed reading deck: make each beat understandable without a speaker. Keep all visual slots within the same editorial budgets. Use the notes field for 60–120 words of source-supported explanation, one worked example when relevant, and assumptions or limitations. Label hypothetical examples. Do not move paragraphs onto the canvas."
    : "Presenter deck: let the visuals carry one clear idea per beat. Keep all visual slots within the same editorial budgets. Use the notes field for a 20–45-word spoken talk track and one transition or caveat. Label hypothetical examples. Do not add a reading essay or paragraphs to the canvas.";
}
