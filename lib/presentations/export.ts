import PptxGenJS from "pptxgenjs";
import { DECK_TEMPLATES } from "./model";
import type { Deck } from "./store";
export async function exportDeck(deck: Deck) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Syaahi user";
  pptx.subject = "Presentation";
  pptx.title = deck.title;
  pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos" };
  const theme = DECK_TEMPLATES[deck.template],
    ink = theme.ink,
    accent = theme.accent;
  deck.slides.forEach((content, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: theme.background };
    const text = (
      value: string,
      x: number,
      y: number,
      w: number,
      h: number,
      fontSize = 21,
      bold = false,
      color: string = ink,
    ) =>
      slide.addText(value, {
        x,
        y,
        w,
        h,
        fontFace: deck.language === "hindi" ? "Nirmala UI" : "Aptos",
        fontSize,
        bold,
        color,
        margin: 0,
        breakLine: false,
        valign: "top",
        fit: "shrink",
      });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y: 0.48,
      w: 0.55,
      h: 0.06,
      fill: { color: accent },
      line: { color: accent },
    });
    if (content.layout === "cover") {
      text(content.title, 0.8, 1.65, 11.5, 1.65, 42, true);
      text(content.subtitle, 0.85, 3.6, 10.9, 1.05, 24);
      text("PRESENTATION", 0.85, 1.03, 10, 0.3, 12, true, accent);
    } else {
      text(content.title, 0.65, 0.8, 12, 1.05, 31, true);
      if (content.subtitle) text(content.subtitle, 0.7, 1.95, 11.9, 0.55, 17);
      if (content.layout === "comparison")
        content.columns.forEach((col, i) => {
          const x = 0.75 + i * 6.15;
          text(col.title, x, 2.8, 5.6, 0.65, 24, true, accent);
          col.points.forEach((point, j) =>
            text(point, x, 3.6 + j * 0.68, 5.5, 0.62, 18),
          );
        });
      else if (content.layout === "process")
        content.steps.forEach((step, i) => {
          const w = 11.5 / content.steps.length,
            x = 0.8 + i * w;
          text(
            String(i + 1).padStart(2, "0"),
            x,
            3.05,
            w - 0.25,
            0.8,
            42,
            true,
            accent,
          );
          text(step, x, 4.1, w - 0.32, 1.7, 22, true);
        });
      else if (content.layout === "table")
        slide.addTable(
          content.table.map((row) => row.map((value) => ({ text: value }))),
          {
            x: 0.7,
            y: 2.85,
            w: 11.9,
            h: 3.3,
            border: { type: "solid", pt: 0.6, color: accent },
            color: ink,
            fill: { color: theme.background },
            fontFace: deck.language === "hindi" ? "Nirmala UI" : "Aptos",
            fontSize: 17,
            margin: 0.12,
            autoPage: false,
            rowH: 0.48,
            bold: false,
          },
        );
      else if (content.layout === "chart" && content.chart)
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
            x: 0.7,
            y: 2.8,
            w: 11.9,
            h: 3.6,
            catAxisLabelColor: ink,
            valAxisLabelColor: ink,
            chartColors: [accent],
            showLegend: false,
            showValue: true,
            dataLabelColor: ink,
            showTitle: false,
          },
        );
      else
        content.bullets.forEach((point, i) => {
          text(
            String(i + 1).padStart(2, "0"),
            0.75,
            2.85 + i * 0.64,
            0.52,
            0.55,
            18,
            true,
            accent,
          );
          text(point, 1.5, 2.85 + i * 0.64, 10.75, 0.6, 21);
        });
    }
    if (content.citations.length)
      text(content.citations.join(" · "), 0.7, 6.65, 11.6, 0.3, 9);
    text(`${index + 1} / ${deck.slides.length}`, 11.9, 7.05, 0.7, 0.22, 10);
    slide.addNotes(
      `${content.notes}\n\nSources: ${content.citations.join("\n") || "AI-generated study explanation. Verify important claims."}`,
    );
  });
  return Buffer.from(
    (await pptx.write({ outputType: "nodebuffer" })) as Buffer,
  );
}
