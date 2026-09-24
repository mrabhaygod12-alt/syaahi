import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { renderDocument, type PrintNote } from "./document";
let assets: { fonts: string; math: string } | null = null;
export function printAssets() {
  if (assets) return assets;
  let fonts = "";
  for (const [pkg, family, subsets] of [
    ["caveat", "Caveat", ["latin", "latin-ext"]],
    ["kalam", "Kalam", ["latin", "latin-ext", "devanagari"]],
    ["patrick-hand", "Patrick Hand", ["latin", "latin-ext"]],
  ] as const) {
    for (const subset of subsets) {
      const data = readFileSync(
        join(
          process.cwd(),
          `node_modules/@fontsource/${pkg}/files/${pkg}-${subset}-400-normal.woff2`,
        ),
      );
      const range =
        subset === "devanagari"
          ? "U+0900-097F,U+1CD0-1CFF,U+200C-200D,U+20B9,U+25CC,U+A830-A839,U+A8E0-A8FF"
          : subset === "latin"
            ? "U+0000-00FF,U+2000-206F,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
            : "U+0100-02FF,U+1D00-1DBF,U+1E00-1EFF";
      fonts += `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${data.toString("base64")}) format('woff2');unicode-range:${range}}`;
    }
  }
  const math = readFileSync(
    join(process.cwd(), "node_modules/katex/dist/katex.min.css"),
    "utf8",
  ).replace(/url\(([^)]+)\)/g, (_match, raw: string) => {
    const name = raw.replace(/["']/g, "");
    if (!name.startsWith("fonts/")) return "url()";
    return `url(data:font/woff2;base64,${readFileSync(join(process.cwd(), "node_modules/katex/dist", name)).toString("base64")})`;
  });
  return (assets = { fonts, math });
}
export function noteHtml(notes: PrintNote[]) {
  const { fonts, math } = printAssets();
  return renderDocument(notes, fonts, math);
}
const shared = globalThis as unknown as {
  printBrowser?: Promise<Browser>;
  printActive?: number;
};
export async function renderPdf(
  notes: PrintNote[],
): Promise<{ bytes: Buffer; pages: number }> {
  if ((shared.printActive || 0) >= 2)
    throw new Error("PDF renderer is busy. Please retry shortly.");
  shared.printActive = (shared.printActive || 0) + 1;
  let context;
  try {
    if (!shared.printBrowser)
      shared.printBrowser = chromium
        .launch({ headless: true })
        .catch((error) => {
          shared.printBrowser = undefined;
          throw error;
        });
    const browser = await shared.printBrowser;
    if (!browser.isConnected()) {
      shared.printBrowser = undefined;
      throw new Error("PDF renderer restarting. Please retry.");
    }
    context = await browser.newContext({
      viewport: { width: 794, height: 1123 },
    });
    // All assets are embedded. Never fetch user-supplied URLs during rendering.
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(noteHtml(notes), {
      waitUntil: "load",
      timeout: 30000,
    });
    await page.waitForFunction(
      () =>
        document.documentElement.dataset.ready ||
        document.documentElement.dataset.error,
      { timeout: 30000 },
    );
    const result = await page.evaluate(() => ({
      error: document.documentElement.dataset.error,
      pages: Number(document.documentElement.dataset.pages),
      overflow: [...document.querySelectorAll<HTMLElement>(".sheet-body")].some(
        (e) => e.scrollHeight > e.clientHeight + 1,
      ),
    }));
    if (result.error || result.overflow || !result.pages)
      throw new Error(result.error || "Page layout could not be verified.");
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
    });
    return { bytes, pages: result.pages };
  } finally {
    await context?.close();
    shared.printActive = Math.max(0, (shared.printActive || 1) - 1);
  }
}
