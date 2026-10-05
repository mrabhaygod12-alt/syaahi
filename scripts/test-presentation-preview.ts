import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import sharp from "sharp";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-layouts-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
async function main() {
  const { SLIDE_LAYOUTS, validateSlide } =
      await import("../lib/presentations/model"),
    { deckHtml } = await import("../lib/presentations/visual-export"),
    { exportDeck } = await import("../lib/presentations/native-export"),
    { uploadWritingImage } = await import("../lib/writing/images"),
    { register } = await import("../lib/auth/server");
  const owner = await register(
      "Layout fixture",
      "layouts@example.test",
      "safe-fixture-password",
    ),
    image = await uploadWritingImage(
      owner.id,
      await sharp({
        create: { width: 640, height: 360, channels: 3, background: "#267360" },
      })
        .png()
        .toBuffer(),
      "Green example image",
    );
  const dir = "output/live-audit/studio/layout-fixtures";
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    await page.route("**/*", (route) => route.abort());
    for (const language of ["english", "hindi"]) {
      const hi = language === "hindi",
        heading = hi ? "अध्ययन और अभ्यास" : "Learning and practice",
        point = hi
          ? "विषय को समझें और उदाहरण देखें।"
          : "Understand the topic and review an example.";
      const slides = SLIDE_LAYOUTS.map((layout) =>
        validateSlide({
          id: randomUUID(),
          layout,
          title: heading,
          subtitle: hi
            ? "समझें, अभ्यास करें और याद करें"
            : "Understand, practise and recall",
          bullets: [point, point],
          columns: [
            { title: hi ? "पहले" : "Before", points: [point, point] },
            { title: hi ? "बाद में" : "After", points: [point, point] },
          ],
          steps: [
            hi ? "समझें" : "Understand",
            hi ? "अभ्यास करें" : "Practise",
            hi ? "दोहराएँ" : "Review",
          ],
          table: [
            [hi ? "नाम" : "Name", hi ? "मान" : "Value"],
            [hi ? "खाली" : "Empty", ""],
            [hi ? "दूसरा" : "Second", "20"],
          ],
          chart: {
            labels: [hi ? "हानि" : "Loss", hi ? "लाभ" : "Gain"],
            values: [-5, 10],
            label: hi ? "परिवर्तन (इकाइयाँ)" : "Change (units)",
          },
          notes: hi ? "प्रस्तुतकर्ता के निजी नोट्स" : "Private presenter notes",
          citations: [],
          evidence: [],
          imageId: image.id,
          imageAlt: "Green example image",
        }),
      );
      const deck = {
        id: randomUUID(),
        owner: owner.id,
        kind: "presentation",
        title: heading,
        prompt: heading,
        context: "",
        language,
        template: "editorial",
        count: 12,
        outline: slides.map((s) => s.title),
        slides,
        status: "done",
        attempt: 0,
        lease: null,
        leaseUntil: 0,
        provider: "fixture",
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as import("../lib/presentations/store").Deck;
      await page.setContent(await deckHtml(deck), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.locator("html").getAttribute("lang"),
        hi ? "hi" : "en",
      );
      for (const [index, layout] of SLIDE_LAYOUTS.entries()) {
        const canvas = page.locator(".deck-canvas").nth(index);
        const clipped = await canvas.evaluate((element) =>
          Array.from(
            element.querySelectorAll<HTMLElement>(".deck-object, .deck-data"),
          )
            .filter(
              (box) =>
                !box.querySelector("img") &&
                (box.scrollHeight > box.clientHeight + 2 ||
                  box.scrollWidth > box.clientWidth + 2),
            )
            .map((box) => box.textContent),
        );
        assert.deepEqual(
          clipped,
          [],
          `${language} ${layout} normal fixture should fit`,
        );
        await canvas.screenshot({ path: `${dir}/${language}-${layout}.png` });
      }
      writeFileSync(`${dir}/${language}-layouts.pptx`, await exportDeck(deck));
      const stress = {
        ...deck,
        slides: [
          {
            ...slides[1],
            objects: [
              {
                id: "stress-text",
                type: "text" as const,
                text: (hi
                  ? "बहुत लंबा उदाहरण "
                  : "Long stress example "
                ).repeat(60),
                x: 10,
                y: 40,
                w: 10,
                h: 5,
                fontSize: 72,
                color: "#183F35",
                bold: false,
                align: "left" as const,
              },
            ],
          },
        ],
      };
      await page.setContent(await deckHtml(stress), { waitUntil: "load" });
      assert(
        await page
          .locator(".deck-object")
          .evaluate((box) => box.scrollHeight > box.clientHeight + 2),
      );
    }
    console.log(
      "PASS presentation preview: all 12 layouts fit English/Hindi sample content; blank cells, signed chart, owned image, language tags and genuine dense-text clipping verified. Native PPTX fixtures saved for separate renderer inspection.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
