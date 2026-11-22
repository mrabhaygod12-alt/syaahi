import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";

const base = process.env.ASSIGNMENT_STUDIO_URL || "http://localhost:3103";
const timestamp = new Date().toISOString();
const id = "d9a0da5d-8f0a-49ae-9b53-9904a06ec591";
let assignment: any = null;
const source = {
  doi: "10.5555/privacy.2025",
  title: "Privacy in university AI systems",
  authors: ["Ada Researcher"],
  year: 2025,
  venue: "Journal of Responsible Computing",
  url: "https://doi.org/10.5555/privacy.2025",
  abstract: "A verified bibliographic abstract for browser testing.",
  indexedBy: ["Crossref", "OpenAlex"],
};

async function noHorizontalOverflow(page: Page, width: number) {
  const result = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert(
    result.scroll <= result.viewport + 1,
    `Horizontal overflow at ${width}px: ${result.scroll}px content in ${result.viewport}px viewport.`,
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => {
      throw error;
    });
    await page.route("**/api/assignments**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/api/assignments/suggest") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            pages: 6,
            reason:
              "The brief includes a comparison and a source-led conclusion.",
          }),
        });
      } else if (url.pathname === "/api/assignments/research") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            sources: [source],
            coverage: ["Crossref", "OpenAlex"],
          }),
        });
      } else if (
        url.pathname === "/api/assignments" &&
        request.method() === "POST"
      ) {
        const body = request.postDataJSON();
        assignment = {
          id,
          title: body.title,
          course: body.course,
          topic: body.topic,
          instructions: body.instructions,
          format: body.format,
          pageCount: body.pageCount,
          paper: body.paper,
          font: body.font,
          citationStyle: body.citationStyle,
          sources: [source],
          phase: "outline",
          status: "outline",
          progress: 0,
          outline: [
            "Evidence acquisition choices",
            "Reliability and limitations",
          ],
          sections: [],
          revisionCount: 0,
          attemptCount: 0,
          error: null,
          chargedCredits: 8,
          createdAt: timestamp,
          updatedAt: timestamp,
          finishedAt: null,
        };
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ assignment, balance: 32 }),
        });
      } else if (
        url.pathname === "/api/assignments" &&
        request.method() === "GET"
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            assignments: assignment ? [assignment] : [],
            balance: 40,
          }),
        });
      } else if (url.pathname === `/api/assignments/${id}`) {
        if (request.method() === "PATCH") {
          const body = request.postDataJSON();
          if (body.action === "outline") assignment.outline = body.outline;
          if (body.action === "approve") {
            assignment.status = "ready";
            assignment.phase = "draft";
            assignment.progress = 100;
            assignment.sections = [
              {
                heading: "Evidence acquisition choices",
                markdown:
                  "A clear chain of custody makes digital evidence more defensible.\n\n- Record each transfer and tool version.\n- Preserve hashes and original media.\n\nDiagram: Identify | Preserve | Verify",
                sources: [source.doi],
              },
              {
                heading: "Reliability and limitations",
                markdown:
                  "Examiners should explain the method, uncertainty, and limitations.\n\n| Method | Strength | Limitation |\n| --- | --- | --- |",
                sources: [source.doi],
              },
            ];
          }
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ assignment, balance: 32 }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ assignment }),
        });
      } else {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unmocked route" }),
        });
      }
    });

    await page.goto(`${base}/assignment`, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", {
        name: /What assignment are you working on/i,
      })
      .waitFor();
    assert.equal(
      await page
        .locator(
          "footer.site-footer, footer.app-copyright, footer.publication-footer",
        )
        .count(),
      0,
      "Assignment Studio should not render the site footer.",
    );
    const essentialOnly = page.getByRole("button", { name: "Essential only" });
    if (await essentialOnly.isVisible())
      await essentialOnly.evaluate((button: HTMLButtonElement) =>
        button.click(),
      );
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await noHorizontalOverflow(page, width);
    }
    if (process.env.ASSIGNMENT_STUDIO_SCREENSHOT) {
      await page.setViewportSize({ width: 1440, height: 980 });
      await page.screenshot({
        path: process.env.ASSIGNMENT_STUDIO_SCREENSHOT,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByLabel("Assignment prompt")
      .fill(
        "Create a source-led analysis of privacy in university AI systems.",
      );
    await page.getByRole("button", { name: "Continue" }).click();
    await page
      .getByLabel("Assignment title")
      .fill("Privacy in large language models");
    await page.getByLabel("Course or department").fill("MSc Computer Science");
    await page
      .getByLabel("Topic or research question")
      .fill("How should universities govern student data in LLM tools?");
    await page
      .getByLabel("Instructions and rubric")
      .fill(
        "Compare privacy risks and mitigation approaches, include a balanced conclusion, and cite credible research.",
      );
    await page.getByRole("button", { name: /Continue to research/ }).click();
    await page.getByRole("button", { name: /Suggest/ }).click();
    await page.getByText(/AI suggests 6 content pages/).waitFor();
    assert.equal(
      await page.locator('input[type="number"]').inputValue(),
      "6",
      "The AI suggestion should update the editable page count.",
    );
    await page.getByRole("button", { name: /Find sources/ }).click();
    await page.getByText("Privacy in university AI systems").waitFor();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Create research plan/ }).click();
    await page.getByRole("heading", { name: "Review the outline" }).waitFor();
    await page.getByRole("button", { name: /Approve and draft/ }).click();
    await page.getByText("Draft complete · 2 pages").waitFor();
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await noHorizontalOverflow(page, width);
    }
    await page
      .getByRole("button", { name: /Reliability and limitations/ })
      .click();
    await page
      .getByRole("heading", { name: "Reliability and limitations" })
      .waitFor();
    await page
      .getByRole("button", { name: "Enter full screen preview" })
      .click();
    assert.match(
      (await page.locator(".assignment-main").getAttribute("class")) || "",
      /is-preview-fullscreen/,
      "The preview toolbar should enter full-screen focus mode.",
    );
    await noHorizontalOverflow(page, 390);
    await page
      .getByRole("button", { name: "Exit full screen preview" })
      .click();
    console.log(
      "PASS: prompt-first setup, brief details, research selection, outline approval, page navigation, and responsive full-page preview work without horizontal overflow at 360, 390, 768, 1024, and 1440px.",
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
