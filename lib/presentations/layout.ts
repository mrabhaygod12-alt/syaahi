import {
  DECK_TEMPLATES,
  type DeckSlide,
  type DeckTemplate,
  type BrandKit,
  type SlideObject,
} from "./model";
export const SLIDE_SIZE = { width: 13.333333, height: 7.5 };
export function presentationLanguage(language: string) {
  return (
    (
      {
        english: "en",
        hindi: "hi",
        hinglish: "hi-Latn",
        german: "de",
        french: "fr",
        spanish: "es",
      } as Record<string, string>
    )[language] || "en"
  );
}
export function presentationFont(language: string, font: string) {
  return language === "hindi" ? "Nirmala UI" : font;
}
export function deckTheme(template: DeckTemplate, brand?: BrandKit) {
  return brand || { ...DECK_TEMPLATES[template], font: "Arial" as const };
}
export function slideObjects(
  slide: DeckSlide,
  ink: string,
  accent: string,
): SlideObject[] {
  if (slide.objects) return slide.objects;
  const objects: SlideObject[] = [];
  const add = (
    id: string,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fontSize = 21,
    bold = false,
    color = ink,
  ) =>
    objects.push({
      id,
      type: "text",
      text,
      x,
      y,
      w,
      h,
      fontSize,
      bold,
      color: "#" + color,
      align: "left",
    });
  if (slide.layout === "cover") {
    add("title-box", slide.title, 6, 22, 86, 24, 42, true);
    add("subtitle-box", slide.subtitle, 6, 48, 82, 14, 24);
  } else {
    add("title-box", slide.title, 5, 11, 90, 14, 31, true);
    if (slide.subtitle) add("subtitle-box", slide.subtitle, 5, 26, 90, 9, 17);
    if (["comparison", "case"].includes(slide.layout))
      slide.columns.forEach((c, i) => {
        add(
          `column-heading-${i}`,
          c.title,
          6 + i * 46,
          37,
          42,
          9,
          24,
          true,
          accent,
        );
        c.points.forEach((p, j) =>
          add(`column-point-${i}-${j}`, p, 6 + i * 46, 48 + j * 9, 42, 8, 18),
        );
      });
    else if (["process", "timeline"].includes(slide.layout))
      slide.steps.forEach((p, i) => {
        const w = 86 / slide.steps.length;
        add(
          `step-number-${i}`,
          String(i + 1).padStart(2, "0"),
          6 + i * w,
          41,
          w - 2,
          12,
          36,
          true,
          accent,
        );
        add(`step-text-${i}`, p, 6 + i * w, 56, w - 2, 24, 21, true);
      });
    else if (slide.layout === "quote")
      add(
        "quotation-text",
        `“${slide.bullets[0] || slide.subtitle}”`,
        8,
        43,
        84,
        34,
        32,
      );
    else if (!["table", "chart", "image"].includes(slide.layout))
      slide.bullets.forEach((p, i) =>
        add(
          `body-point-${i}`,
          `${String(i + 1).padStart(2, "0")}  ${p}`,
          6,
          38 + i * 9,
          86,
          8,
          21,
        ),
      );
    if (slide.layout === "image" && slide.imageId)
      objects.push({
        id: "source-image",
        type: "image",
        text: "",
        imageId: slide.imageId,
        imageAlt: slide.imageAlt,
        x: 8,
        y: 38,
        w: 84,
        h: 45,
        fontSize: 20,
        bold: false,
        color: "#" + ink,
        align: "center",
      });
  }
  return objects;
}
export function chartRange(values: number[]) {
  const min = Math.min(0, ...values),
    max = Math.max(0, ...values);
  return {
    min,
    max,
    span: max - min || 1,
    zero: ((0 - min) / (max - min || 1)) * 100,
  };
}
