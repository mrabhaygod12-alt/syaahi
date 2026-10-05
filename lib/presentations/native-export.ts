import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import { writingImage } from "@/lib/writing/images";
import {
  deckTheme,
  slideObjects,
  SLIDE_SIZE,
  presentationFont,
} from "./layout";
import type { Deck } from "./store";
export async function exportDeck(deck: Deck) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Syaahi user";
  pptx.subject = "Presentation";
  pptx.title = deck.title;
  const theme = deckTheme(deck.template, deck.brand),
    font = presentationFont(deck.language, theme.font);
  pptx.theme = { headFontFace: font, bodyFontFace: font };
  const assets = new Map<
    string,
    { data: string; width: number; height: number }
  >();
  for (const content of deck.slides)
    for (const o of slideObjects(content, theme.ink, theme.accent))
      if (o.type === "image" && o.imageId && !assets.has(o.imageId)) {
        const image = await writingImage(o.imageId);
        if (!image || image.owner !== deck.owner)
          throw new Error("An image is no longer available in your account.");
        const bytes = await sharp(image.bytes).png().toBuffer();
        const size = await sharp(bytes).metadata();
        assets.set(o.imageId, {
          data: "image/png;base64," + bytes.toString("base64"),
          width: size.width!,
          height: size.height!,
        });
      }
  for (const [index, content] of deck.slides.entries()) {
    const slide = pptx.addSlide();
    slide.background = { color: theme.background };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y: 0.48,
      w: 0.55,
      h: 0.06,
      fill: { color: theme.accent },
      line: { color: theme.accent },
    });
    for (const o of slideObjects(content, theme.ink, theme.accent)) {
      const box = {
        x: (o.x / 100) * SLIDE_SIZE.width,
        y: (o.y / 100) * SLIDE_SIZE.height,
        w: (o.w / 100) * SLIDE_SIZE.width,
        h: (o.h / 100) * SLIDE_SIZE.height,
      };
      if (o.type === "image" && o.imageId) {
        const asset = assets.get(o.imageId)!;
        const scale = Math.min(box.w / asset.width, box.h / asset.height),
          w = asset.width * scale,
          h = asset.height * scale;
        slide.addImage({
          data: asset.data,
          x: box.x + (box.w - w) / 2,
          y: box.y + (box.h - h) / 2,
          w,
          h,
          altText: o.imageAlt || "Slide image",
        });
      } else
        slide.addText(o.text, {
          ...box,
          fontFace: font,
          fontSize: o.fontSize,
          bold: o.bold,
          color: o.color.slice(1),
          align: o.align,
          valign: "top",
          margin: 0,
          breakLine: false,
        });
    }
    if (content.layout === "table")
      slide.addTable(
        content.table.map((row) => row.map((text) => ({ text }))),
        {
          x: 0.08 * SLIDE_SIZE.width,
          y: 0.38 * SLIDE_SIZE.height,
          w: 0.84 * SLIDE_SIZE.width,
          h: 0.45 * SLIDE_SIZE.height,
          border: { type: "solid", pt: 0.6, color: theme.accent },
          color: theme.ink,
          fill: { color: theme.background },
          fontFace: font,
          fontSize: 17,
          margin: 0.1,
          autoPage: false,
          rowH: (0.45 * SLIDE_SIZE.height) / content.table.length,
        },
      );
    if (content.layout === "chart" && content.chart)
      slide.addChart(
        pptx.ChartType.bar,
        [
          {
            name: content.chart.label,
            labels: content.chart.labels,
            values: content.chart.values,
          },
        ],
        {
          x: 0.08 * SLIDE_SIZE.width,
          y: 0.38 * SLIDE_SIZE.height,
          w: 0.84 * SLIDE_SIZE.width,
          h: 0.45 * SLIDE_SIZE.height,
          barDir: "bar",
          catAxisLabelColor: theme.ink,
          catAxisLabelPos: "low",
          catAxisLabelFontFace: font,
          catAxisLabelFontSize: 15,
          valAxisLabelColor: theme.ink,
          valAxisLabelFontFace: font,
          valAxisLabelFontSize: 13,
          chartColors: [theme.accent],
          showLegend: false,
          showValue: true,
          showLabel: true,
          dataLabelColor: theme.ink,
          dataLabelFontFace: font,
          dataLabelFontSize: 15,
          dataLabelPosition: "outEnd",
          dataLabelFormatCode: "General",
          showTitle: true,
          title: content.chart.label,
          titleFontFace: font,
          titleFontSize: 20,
          titleColor: theme.ink,
        },
      );
    if (content.citations.length)
      slide.addText(content.citations.join(" · "), {
        x: 0.7,
        y: 6.75,
        w: 11.5,
        h: 0.35,
        fontFace: font,
        fontSize: 9,
        color: theme.ink,
        margin: 0,
      });
    slide.addText(`${index + 1} / ${deck.slides.length}`, {
      x: 11.9,
      y: 7.05,
      w: 0.7,
      h: 0.22,
      fontFace: font,
      fontSize: 10,
      color: theme.ink,
      margin: 0,
    });
    slide.addNotes(
      `${content.notes}\n\nSources: ${content.citations.join("\n") || "AI-generated explanation. Verify important claims."}`,
    );
  }
  return Buffer.from(
    (await pptx.write({ outputType: "nodebuffer" })) as Buffer,
  );
}
