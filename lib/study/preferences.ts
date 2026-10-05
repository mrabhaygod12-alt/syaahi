export interface ReaderPreferences {
  revision: number;
  mode: "print" | "reading";
  size: 18 | 20 | 24 | 28;
  width: 56 | 68 | 80;
  lineHeight: 1.5 | 1.7 | 2;
  tone: "paper" | "white" | "night";
  focus: boolean;
}
export const readerDefaults = (): ReaderPreferences => ({
  revision: 0,
  mode: "print",
  size: 20,
  width: 68,
  lineHeight: 1.7,
  tone: "paper",
  focus: false,
});
export function validateReader(
  value: any,
  revision: number,
): ReaderPreferences {
  if (
    !value ||
    !["print", "reading"].includes(value.mode) ||
    ![18, 20, 24, 28].includes(value.size) ||
    ![56, 68, 80].includes(value.width) ||
    ![1.5, 1.7, 2].includes(value.lineHeight) ||
    !["paper", "white", "night"].includes(value.tone) ||
    typeof value.focus !== "boolean"
  )
    throw new Error("Choose valid reading preferences.");
  return {
    revision,
    mode: value.mode,
    size: value.size,
    width: value.width,
    lineHeight: value.lineHeight,
    tone: value.tone,
    focus: value.focus,
  };
}
