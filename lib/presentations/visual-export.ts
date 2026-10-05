import { chromium, type Browser } from "playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writingImage } from "@/lib/writing/images";
import { deckTheme, slideObjects, chartRange } from "./layout";
import type { Deck } from "./store";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const runtime = globalThis as unknown as {
  deckPrintBrowser?: Promise<Browser>;
  deckPrintActive?: number;
};
export async function deckHtml(deck: Deck) {
  const theme = deckTheme(deck.template, deck.brand),
    images = new Map<string, string>();
  for (const slide of deck.slides)
    for (const object of slideObjects(slide, theme.ink, theme.accent))
      if (
        object.type === "image" &&
        object.imageId &&
        !images.has(object.imageId)
      ) {
        const image = await writingImage(object.imageId);
        if (!image || image.owner !== deck.owner)
          throw new Error("A slide image is unavailable.");
        images.set(
          object.imageId,
          "data:image/webp;base64," + image.bytes.toString("base64"),
        );
      }
  const css = readFileSync(
    join(process.cwd(), "components/presentations/presentation-studio.css"),
    "utf8",
  );
  const slides = deck.slides
    .map((slide, index) => {
      const objects = slideObjects(slide, theme.ink, theme.accent)
        .map(
          (o) =>
            `<div class="deck-object" style="position:absolute;left:${o.x}%;top:${o.y}%;width:${o.w}%;height:${o.h}%;font-size:${o.fontSize / 9.6}cqw;font-weight:${o.bold ? 700 : 400};color:${o.color};text-align:${o.align}">${o.type === "image" ? `<img src="${images.get(o.imageId!)}" alt="${escape(o.imageAlt || "")}">` : escape(o.text)}</div>`,
        )
        .join("");
      const table =
        slide.layout === "table"
          ? `<div class="deck-data"><table><tbody>${slide.table.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
          : "";
      const chart = slide.chart,
        r = chartRange(chart?.values || [0]);
      const bars =
        slide.layout === "chart" && chart
          ? `<div class="deck-data deck-chart"><p>${escape(chart.label)}</p>${chart.labels
              .map((label, i) => {
                const pos = ((chart.values[i] - r.min) / r.span) * 100;
                return `<div class="deck-chart-row"><span>${escape(label)}</span><div class="deck-plot"><i class="deck-zero" style="left:${r.zero}%"></i><i class="deck-bar" style="left:${Math.min(pos, r.zero)}%;width:${Math.abs(pos - r.zero)}%;background:#${theme.accent}"></i></div><strong>${chart.values[i]}</strong></div>`;
              })
              .join("")}</div>`
          : "";
      return `<article class="deck-canvas" style="background:#${theme.background};color:#${theme.ink};font-family:'${theme.font}',Arial,sans-serif"><div class="deck-accent" style="background:#${theme.accent}"></div>${objects}${table}${bars}<footer><span>${escape(slide.citations.join(" · "))}</span><b>${index + 1}</b></footer></article>`;
    })
    .join("");
  return `<!doctype html><html lang="${deck.language}"><head><meta charset="utf-8"><title>${escape(deck.title)}</title><style>${css}\n@page{size:13.333333in 7.5in;margin:0}body{margin:0;background:white}.deck-canvas{width:1280px;height:720px;box-shadow:none;break-after:page}*{box-sizing:border-box}@media print{.deck-canvas{break-after:page}.deck-canvas:last-child{break-after:auto}}</style></head><body>${slides}</body></html>`;
}
export async function visualExport(
  deck: Deck,
  format: "pdf" | "png" | "notes",
  slideIndex = 0,
) {
  if ((runtime.deckPrintActive || 0) >= 1)
    throw new Error("Presentation renderer is busy. Retry shortly.");
  runtime.deckPrintActive = (runtime.deckPrintActive || 0) + 1;
  let context;
  try {
    if (!runtime.deckPrintBrowser)
      runtime.deckPrintBrowser = chromium
        .launch({ headless: true })
        .catch((e) => {
          runtime.deckPrintBrowser = undefined;
          throw e;
        });
    const browser = await runtime.deckPrintBrowser;
    if (!browser.isConnected()) {
      runtime.deckPrintBrowser = undefined;
      throw new Error("Renderer restarting. Retry shortly.");
    }
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    const html =
      format === "notes"
        ? `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font:14px Arial,sans-serif;color:#173f35}section{break-inside:avoid;margin:24px 0;border-top:1px solid #ddd;padding:20px 0}p{white-space:pre-wrap;line-height:1.6}</style></head><body><h1>${escape(deck.title)}</h1>${deck.slides.map((s, i) => `<section><h2>${i + 1}. ${escape(s.title)}</h2><p>${escape(s.notes)}</p><small>${escape(s.citations.join(" · "))}</small></section>`).join("")}</body></html>`
        : await deckHtml(deck);
    await page.setContent(html, { waitUntil: "load", timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    if (format === "png") {
      if (
        !Number.isInteger(slideIndex) ||
        slideIndex < 0 ||
        slideIndex >= deck.slides.length
      )
        throw new Error("Choose a valid slide index.");
      return Buffer.from(
        await page
          .locator(".deck-canvas")
          .nth(slideIndex)
          .screenshot({ type: "png", timeout: 30000 }),
      );
    }
    return Buffer.from(
      await bounded(
        page.pdf({
          printBackground: true,
          preferCSSPageSize: true,
          tagged: true,
          ...(format === "notes"
            ? { format: "A4" as const }
            : { width: "13.333333in", height: "7.5in" }),
        }),
        30000,
      ),
    );
  } finally {
    await context?.close();
    runtime.deckPrintActive = Math.max(0, (runtime.deckPrintActive || 1) - 1);
  }
}

async function bounded<T>(operation: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error("Presentation export timed out. Retry shortly.")),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
