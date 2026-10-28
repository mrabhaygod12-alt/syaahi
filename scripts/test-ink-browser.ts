import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { fixturePdf } from "./fixtures/pdf";
import { fixtureDocx } from "./fixtures/docx";
const origin = "http://localhost:3217";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-ink-browser-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  WORKER_MODE: "external",
  BACKEND_URL: "",
  NEXT_DIST_DIR: ".next-validation",
  NEXT_PUBLIC_APP_URL: origin,
  TAVILY_API_KEY: "",
  BRAVE_SEARCH_API_KEY: "",
});
async function main() {
  const auth = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { saveOrder } = await import("../lib/billing/orders"),
    { db } = await import("../lib/db");
  const user = await auth.register(
    "Ink student",
    "ink-browser@example.test",
    "fixture-password-long",
  );
  await markEmailVerified(user.id);
  await saveOrder("ink-browser-paid", user.id, "try", 900, 3);
  db()
    .prepare(
      "UPDATE orders SET paid=1,payment_id='pay_browser_fixture' WHERE id='ink-browser-paid'",
    )
    .run();
  const free = await auth.register(
    "Free student",
    "ink-free@example.test",
    "fixture-password-long",
  );
  await markEmailVerified(free.id);
  const cookie = async (u: typeof user) =>
    (await auth.startSession(u, new Request(origin))).headers
      .get("set-cookie")!
      .split(";")[0]
      .split("=")[1];
  const paidCookie = await cookie(user),
    freeCookie = await cookie(free);
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3217"],
    { env: process.env, windowsHide: true, stdio: "ignore" },
  );
  const browser = await chromium.launch({ headless: true });
  try {
    let healthy = false;
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(origin + "/api/health")).ok) {
          healthy = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    assert(healthy, "test server did not start");
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies([
      { name: "syaahi-session", value: paidCookie, url: origin },
    ]);
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const text =
      "Machine learning models require substantial amounts of labelled training data to generalise well. When the training set is small or biased the resulting model tends to reproduce those biases at inference time. Researchers have therefore explored semi supervised approaches that combine a small labelled set with a much larger unlabelled corpus.";
    const out = "output/ink-research";
    mkdirSync(out, { recursive: true });
    const overflow = async (label: string) =>
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        label + " overflows",
      );
    await page.goto(origin + "/ink/sources");
    if (
      await page
        .getByRole("button", { name: "Essential only", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Essential only", exact: true })
        .click();
    await page.getByRole("button", { name: "Add source", exact: true }).click();
    const indexDialog = page.getByRole("dialog", {
      name: "Add a private source",
    });
    await indexDialog.getByLabel("Import index source").setInputFiles({
      name: "research-reference.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: fixtureDocx(text),
    });
    await indexDialog
      .getByLabel("Source title")
      .fill("Private research reference");
    await indexDialog
      .getByRole("button", { name: "Index source", exact: true })
      .click();
    await indexDialog.waitFor({ state: "hidden" });
    await page
      .getByRole("heading", { name: "Private research reference", exact: true })
      .waitFor();
    await page
      .getByLabel("Search indexed sources")
      .fill("missing source title");
    await page.getByText("No sources found.", { exact: true }).waitFor();
    await page.getByLabel("Search indexed sources").fill("");
    await page.goto(origin + "/ink");
    await page
      .getByRole("button", { name: "Upload document", exact: true })
      .waitFor();
    if (
      await page
        .getByRole("button", { name: "Essential only", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Essential only", exact: true })
        .click();
    await page.screenshot({
      path: out + "/desktop-upload.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: /Or paste your text/ }).click();
    const paste = page.getByRole("dialog", { name: "Paste your draft" });
    await paste
      .getByLabel("Title", { exact: true })
      .fill("Research chapter — integrity review");
    await paste.getByLabel("Your text", { exact: true }).fill(text);
    await page.screenshot({ path: out + "/paste-dialog.png" });
    await paste.getByRole("button", { name: "Use this draft" }).click();
    assert.equal(await page.locator("#ink-text").inputValue(), text);
    // Cancel replacing a populated draft; then exercise real PDF and DOCX import through the UI.
    await page.locator("#ink-file").setInputFiles({
      name: "chapter.pdf",
      mimeType: "application/pdf",
      buffer: fixturePdf(text),
    });
    const replace = page.getByRole("dialog", {
      name: "Replace your current draft?",
    });
    await replace.getByRole("button", { name: "Keep current draft" }).click();
    assert.equal(await page.locator("#ink-text").inputValue(), text);
    await page.locator("#ink-file").setInputFiles({
      name: "chapter.pdf",
      mimeType: "application/pdf",
      buffer: fixturePdf(text),
    });
    await replace
      .getByRole("button", { name: "Replace draft", exact: true })
      .click();
    await page.getByText("chapter.pdf", { exact: true }).waitFor();
    await page.locator("#ink-file").setInputFiles({
      name: "chapter.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: fixtureDocx(text),
    });
    await replace
      .getByRole("button", { name: "Replace draft", exact: true })
      .click();
    await page.getByText("chapter.docx", { exact: true }).waitFor();
    assert.equal((await page.locator("#ink-text").inputValue()).trim(), text);
    await page.locator("#ink-file").setInputFiles({
      name: "broken.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("not a zip"),
    });
    await replace
      .getByRole("button", { name: "Replace draft", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    assert.equal(
      (await page.locator("#ink-text").inputValue()).trim(),
      text,
      "failed upload replaced good draft",
    );
    await page.getByRole("button", { name: "Add comparison sources" }).click();
    const sources = page.getByRole("dialog", { name: "Comparison sources" });
    await sources.getByLabel("Reference text to compare (optional)").fill(text);
    await page.keyboard.press("Escape");
    assert.equal(await sources.isVisible(), false);
    assert.equal(
      await page
        .getByRole("button", { name: "Add comparison sources" })
        .evaluate((e) => e === document.activeElement),
      true,
      "dialog did not restore focus",
    );
    await page
      .locator("#ink-title")
      .fill("Research chapter — integrity review");
    await page.screenshot({
      path: out + "/desktop-composer.png",
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Check this draft", exact: true })
      .click();
    await page.waitForURL(/\/ink\/report\//);
    await page
      .getByRole("heading", {
        name: "Research chapter — integrity review",
        exact: true,
      })
      .waitFor();
    assert((await page.locator("mark[data-kind=plag]").count()) > 0);
    const id = page.url().split("/").pop()!;
    await page
      .getByText(/Private index: 1 indexed, 1 candidates, 1 compared/)
      .waitFor();
    await page
      .getByRole("button", { name: "Similarity filters", exact: true })
      .click();
    const filters = page.getByRole("dialog", {
      name: "Similarity filters",
      exact: true,
    });
    await filters.getByLabel("Exclude bibliography", { exact: true }).check();
    await filters
      .getByLabel("Exclude paired quotations", { exact: true })
      .check();
    await filters
      .getByLabel("Minimum matching words", { exact: true })
      .fill("100");
    await filters.getByRole("button", { name: "Done", exact: true }).click();
    assert.equal(
      await page.locator("mark[data-kind=plag]").count(),
      0,
      "minimum run filter removes short runs",
    );
    await page
      .getByRole("button", { name: "Similarity filters", exact: true })
      .click();
    await filters
      .getByRole("button", { name: "Reset filters", exact: true })
      .click();
    assert.equal(
      await filters
        .getByLabel("Exclude bibliography", { exact: true })
        .isChecked(),
      false,
    );
    await filters.getByRole("button", { name: "Done", exact: true }).click();
    assert(
      (await page.locator("mark[data-kind=plag]").count()) > 0,
      "reset restores original evidence",
    );
    await page.getByRole("tab", { name: /Document/ }).focus();
    await page.keyboard.press("ArrowRight");
    await page
      .getByRole("heading", { name: "Matching sources", exact: true })
      .waitFor();
    await page.keyboard.press("Home");
    assert.equal(
      await page
        .getByRole("tab", { name: /Document/ })
        .getAttribute("aria-selected"),
      "true",
    );
    const downloadWait = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download report", exact: true })
      .click();
    const downloaded = await downloadWait;
    assert.equal(downloaded.suggestedFilename(), "ai-ink-report.json");
    await page.screenshot({
      path: out + "/desktop-report.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Compare source" }).first().click();
    const evidence = page.getByRole("dialog", {
      name: "Side-by-side evidence",
    });
    await evidence.waitFor();
    assert((await evidence.innerText()).includes("Machine learning"));
    await page.screenshot({ path: out + "/source-dialog.png" });
    await evidence.getByRole("button", { name: "Close dialog" }).click();
    const selectedPassage = (await page
      .locator("mark[data-kind=plag]")
      .first()
      .textContent())!.trim();
    await page
      .getByRole("link", { name: "Improve", exact: true })
      .first()
      .click();
    await page.getByLabel("Passage", { exact: true }).waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLTextAreaElement>("#ink-rewrite-text")!.value
          .length > 100,
    );
    assert.equal(
      (await page.getByLabel("Passage", { exact: true }).inputValue()).trim(),
      selectedPassage,
    );
    // Explicit local provider fixtures: verify failure preservation and successful review/apply UI.
    await page.getByRole("button", { name: "My voice", exact: true }).click();
    const voiceDialog = page.getByRole("dialog", {
      name: "Your writing, as a guide",
    });
    await voiceDialog
      .getByLabel("A sample of your own writing")
      .fill(
        "I describe experiments in plain terms. Each result has a source, and I keep my argument focused on the evidence.",
      );
    await voiceDialog
      .getByRole("button", { name: "Save this sample", exact: true })
      .click();
    await voiceDialog.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Tighten", exact: true }).click();
    await page.route("**/api/ink/rewrite", (r) =>
      r.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Fixture provider unavailable" }),
      }),
    );
    await page
      .getByRole("button", { name: "Rewrite passage", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Fixture provider unavailable" })
      .waitFor();
    assert.equal(
      (await page.getByLabel("Passage", { exact: true }).inputValue()).trim(),
      selectedPassage,
    );
    await page.unroute("**/api/ink/rewrite");
    await page.route("**/api/ink/rewrite", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            text: "Revised fixture passage with the same research argument, ready for a human review.",
            before: 58,
            after: 15,
            provider: "fixture",
            model: "fixture",
          },
        }),
      }),
    );
    await page
      .getByRole("button", { name: "Rewrite passage", exact: true })
      .click();
    await page.getByRole("button", { name: "Use as new draft" }).waitFor();
    await page.screenshot({
      path: out + "/desktop-rewrite.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Use as new draft" }).click();
    await page
      .getByRole("button", { name: "Use revision", exact: true })
      .click();
    assert.match(
      await page.getByLabel("Passage", { exact: true }).inputValue(),
      /Revised fixture/,
    );
    await page.unroute("**/api/ink/rewrite");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
      for (const [key, path] of [
        ["upload", "/ink"],
        ["report", `/ink/report/${id}`],
        ["rewrite", `/ink/rewrite?report=${id}`],
        ["library", "/ink/reports"],
        ["method", "/ink/how-it-works"],
        ["source-index", "/ink/sources"],
        ["product", "/ai-ink"],
      ]) {
        await page.goto(origin + path);
        await page.locator("main h1").waitFor();
        await page
          .getByText("Opening your desk…", { exact: true })
          .waitFor({ state: "hidden" });
        await overflow(`${key} ${width}`);
        await page.screenshot({
          path: `${out}/${width}-${key}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    // Public discovery is indexable; the working report remains private/noindex.
    await page.goto(origin + "/ai-ink");
    // This page is prerendered using the build-time origin, not this test server's port.
    assert.equal(
      new URL(
        (await page.locator('link[rel="canonical"]').getAttribute("href"))!,
      ).pathname,
      "/ai-ink",
    );
    assert(
      !(
        await page.locator('meta[name="robots"]').getAttribute("content")
      )?.includes("noindex"),
    );
    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    assert(schemas.some((s) => JSON.parse(s)["@type"] === "FAQPage"));
    await page.goto(origin + `/ink/report/${id}`);
    assert(
      (
        await page.locator('meta[name="robots"]').getAttribute("content")
      )?.includes("noindex"),
    );
    // Exercise new candidate/reference presentation against the real backend, not a route fixture.
    const original =
      "Machine learning models need a representative training collection and careful evaluation before their findings can support a practical research conclusion.";
    const nearText = original
      .replace("representative", "balanced")
      .replace("practical", "reliable");
    const nearResult = await context.request.post(origin + "/api/ink", {
      headers: { Origin: origin },
      data: {
        text:
          nearText +
          "\n\n" +
          nearText +
          " Results improved by 20 percent [3].\n\nReferences\n[1] Smith, J. (2024). Research. doi:10.1234/fixture-reference",
        referenceText: original.repeat(3),
        allowWeb: false,
        useIndex: false,
        verifyScholarly: false,
        title: "Changed wording review",
        requestId: "browser-phrase-reference",
      },
    });
    assert.equal(nearResult.status(), 200, await nearResult.text());
    const nearReport = (await nearResult.json()).report;
    assert(nearReport.phrasing.candidates.length > 0);
    await page.goto(origin + `/ink/report/${nearReport.id}`);
    await page.locator("mark[data-kind=phrase]").first().waitFor();
    await page
      .getByRole("button", { name: "Compare source", exact: true })
      .first()
      .click();
    await page.getByRole("dialog", { name: "Side-by-side evidence" }).waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: /Citations/ }).click();
    await page
      .getByText("Citation [3] has no matching numbered reference.", {
        exact: true,
      })
      .waitFor();
    await page.screenshot({ path: out + "/references.png", fullPage: true });
    await page.goto(origin + "/ink/sources");
    await page
      .getByRole("button", {
        name: "Remove Private research reference",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Keep source", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Private research reference", exact: true })
      .waitFor();
    await page
      .getByRole("button", {
        name: "Remove Private research reference",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Delete indexed source", exact: true })
      .click();
    await page
      .getByText("A private comparison shelf.", { exact: true })
      .waitFor();
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + "/dashboard");
      const primaryInk = page.locator(".hub-rail nav > a.hub-primary-ink");
      await primaryInk.waitFor();
      assert.equal(await primaryInk.getAttribute("href"), "/ink");
      assert.equal(
        await page.locator('.hub-tools-menu a[href="/ink"]').count(),
        0,
      );
      await overflow(`dashboard primary navigation ${width}`);
    }
    await page.goto(origin + "/ink/reports");
    await page.getByLabel("Search reports").fill("does-not-exist");
    await page.getByText("No documents found", { exact: true }).waitFor();
    await page.getByLabel("Search reports").fill("Research chapter");
    await page.getByRole("link", { name: /Research chapter/ }).waitFor();
    await page.goto(origin + `/ink/report/${id}`);
    await page.getByRole("button", { name: "Delete private report" }).click();
    await page
      .getByRole("button", { name: "Keep report", exact: true })
      .click();
    assert.match(page.url(), /\/ink\/report\//);
    await page.getByRole("button", { name: "Delete private report" }).click();
    await page
      .getByRole("button", { name: "Confirm permanent deletion" })
      .click();
    await page.waitForURL(/\/ink\/reports$/);
    await context.clearCookies();
    await context.addCookies([
      { name: "syaahi-session", value: freeCookie, url: origin },
    ]);
    await page.goto(origin + "/ink");
    await page
      .getByRole("link", { name: "View student plans", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Upload document", exact: true })
        .count(),
      0,
    );
    await context.clearCookies();
    await page.goto(origin + "/ink");
    await page.getByRole("link", { name: "Sign in", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS AI Ink research studio: private-source DOCX import, index/search/delete/cancel, report filters/reset, real phrase evidence/reference issues, public canonical/FAQ and private noindex, PDF/DOCX import/error preservation, selected-passage rewrite with explicit provider fixtures, paid/free/login gates; seven pages at 320/390/768/1440px. No live AI/search calls.",
    );
  } finally {
    await browser.close();
    server.kill();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
