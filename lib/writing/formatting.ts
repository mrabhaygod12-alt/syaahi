export const STORY_FONTS = [
  "Georgia",
  "Arial",
  "Verdana",
  "Times New Roman",
  "Courier New",
];
export const STORY_SIZES = [
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
  "36px",
  "48px",
];
export const STORY_LINE_HEIGHTS = ["1", "1.15", "1.5", "1.8", "2"];
export const safeColor = (value: unknown) =>
  typeof value === "string" && /^#[a-f0-9]{6}$/i.test(value);
