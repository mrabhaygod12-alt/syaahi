import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
const origin = "http://localhost:3161";
async function main() {
  Object.assign(process.env, { DATA_DIR: mkdtempSync(join(tmpdir(), "writer-proxy-ui-")), DATA_BACKEND: "sqlite", MONGODB_URI: "", APP_ROLE: "all", BACKEND_URL: "", BACKEND_PROXY_SECRET: "fixture-proxy-secret-for-local-test-only", NEXT_PUBLIC_APP_URL: origin, NEXT_DIST_DIR: ".next-validation", WORKER_MODE: "external" });
  const replica = await (await import("mongodb-memory-server")).MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.DATA_BACKEND = "mongo";
  process.env.MONGODB_URI = replica.getUri();
  process.env.APP_ORIGIN = origin;
  const auth = await import("../lib/auth/server"), { markEmailVerified } = await import("../lib/billing/rewards"),
    { enrollWriter } = await import("../lib/writing/profile");
  const user = await auth.register("Aarav", "editor-proxy@example.test", "fixture-password-safe");
  await markEmailVerified(user.id); await enrollWriter(user);
  await (await import("../lib/workspace-preference")).setWorkspace(user.id, "writer");
  const session = await auth.startSession(user, new Request(origin));
  const [name, value] = session.headers.get("set-cookie")!.split(";")[0].split("=");
  const servers = [
    spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3160"], { env: { ...process.env, APP_ROLE: "backend" }, windowsHide: true, stdio: ["ignore", "ignore", "inherit"] }),
    spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3161"], { env: { ...process.env, APP_ROLE: "frontend", BACKEND_URL: "http://127.0.0.1:3160" }, windowsHide: true, stdio: ["ignore", "ignore", "inherit"] }),
  ];
  let browser;
  try {
    for (const port of [3160, 3161]) {
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try { if ((await fetch(`http://localhost:${port}/api/health`)).ok) { ready = true; break; } } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
      assert(ready, `Production service ${port} did not start`);
    }
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name, value, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" }]);
    await context.addInitScript(() => localStorage.setItem("syaahi-privacy-v1", "essential"));
    const page = await context.newPage(), errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/write");
    const editor = page.getByRole("textbox", { name: "Story editor" });
    await editor.waitFor();
    // Simulate the production proxy losing only the response after a successful write.
    let loseResponse = true;
    await page.route("**/api/stories", async (route) => {
      if (route.request().method() !== "POST" || !loseResponse) return route.continue();
      loseResponse = false;
      const completed = await route.fetch();
      assert.equal(completed.status(), 200);
      await route.fulfill({ status: 502, contentType: "text/html", body: "<title>Fixture response lost</title>" });
    });
    const title = "A cybersecurity roadmap for university students";
    const long = "Review networking fundamentals, operating systems and responsible security practice. ".repeat(400);
    await page.getByLabel("Story title", { exact: true }).fill(title);
    await editor.fill(long);
    await page.getByText("Saved to your account. Connection recovered.", { exact: true }).waitFor({ timeout: 30000 });
    assert.match(page.url(), /draft=/);
    let rows = (await (await page.request.get(origin + "/api/stories")).json()).stories;
    assert.equal(rows.length, 1); assert.equal(rows[0].body, long.trim());
    const draftId = rows[0].id;
    await editor.press("Control+a");
    await editor.press("Backspace");
    await editor.pressSequentially("Before the image: a practical starting point.");
    await editor.press("Enter");
    await editor.pressSequentially("After the image: keep learning responsibly and test only systems you are permitted to assess. ");
    await editor.press("Enter");
    await editor.pressSequentially("Read the sources, revisit the concepts and build a portfolio of your own work.");
    await editor.press("Control+Home");
    await editor.press("End");
    await page.getByRole("tab", { name: "Insert", exact: true }).click();
    await page.getByRole("button", { name: "Image", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Insert image" });
    const image = await sharp({ create: { width: 160, height: 100, channels: 3, background: "#a9c2ad" } }).png().toBuffer();
    await modal.locator("input[type=file]").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
    await modal.getByLabel("Describe the image for readers").fill("A green illustration for this test story");
    await modal.getByLabel("Caption (optional)").fill("A starting point for the journey");
    await modal.getByRole("button", { name: "Upload and insert" }).click();
    await modal.waitFor({ state: "hidden" });
    await editor.locator("img").waitFor();
    const blocks = await editor.locator(":scope > *").evaluateAll((nodes) => nodes.map((n) => ({ tag: n.tagName, text: n.textContent })));
    assert(blocks.findIndex((b) => b.tag === "IMG") < blocks.findIndex((b) => b.text?.startsWith("After the image")), "Image must stay at the requested position between paragraphs");
    await editor.getByText("After the image", { exact: false }).click();
    await page.getByLabel("Paragraph indent", { exact: true }).fill("2");
    await page.getByLabel("Editor page width").selectOption("960");
    await page.getByText("Saved to your account.", { exact: true }).waitFor({ timeout: 30000 });
    await page.reload(); await editor.waitFor(); await editor.locator("img").waitFor();
    assert.equal(await page.getByLabel("Editor page width").inputValue(), "960");
    rows = (await (await page.request.get(origin + "/api/stories")).json()).stories;
    assert.equal(rows[0].id, draftId); assert(rows[0].document.content.some((n: any) => n.attrs?.indent === 2));
    // Explicit failure before commit must preserve content and show a retry, not "Saved".
    await page.route("**/api/stories", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      return route.fulfill({ status: 503, contentType: "text/html", body: "<title>Temporary fixture outage</title>" });
    });
    await page.getByLabel("Story title").fill("Updated title survives a temporary outage");
    await page.getByRole("button", { name: "Retry save", exact: true }).waitFor({ timeout: 30000 });
    assert.equal(await page.locator(".writer-save-status").innerText(), "Save needs attention");
    await page.unroute("**/api/stories");
    await page.getByRole("button", { name: "Retry save", exact: true }).click();
    await page.getByText("Saved to your account.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const publish = page.getByRole("dialog", { name: "Publish your story" });
    await publish.getByLabel("Story preview summary").fill("A clear university cybersecurity learning route.");
    await publish.getByLabel("Requested publication time").fill("2020-01-01T00:00");
    await publish.getByRole("button", { name: "Close dialog" }).click();
    await page.getByText("Saved to your account.", { exact: true }).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await publish.getByLabel("Requested publication time").fill("");
    await publish.getByRole("button", { name: "Submit for publication" }).click();
    await publish.waitFor({ state: "hidden" });
    await page.getByText("This story is awaiting editorial review.").waitFor();
    // Long document makes the scroll assertion meaningful.
    const longResponse = await page.request.post(origin + "/api/stories", { headers: { origin }, data: { title: "A long layout fixture", document: { type: "doc", content: Array.from({ length: 40 }, () => ({ type: "paragraph", content: [{ type: "text", text: long.slice(0, 220) }] })) }, action: "save" } });
    assert.equal(longResponse.status(), 200);
    const layoutId = (await longResponse.json()).story.id;
    mkdirSync("output/writer-editor", { recursive: true });
    await page.goto(origin + `/write?draft=${layoutId}`); await editor.waitFor();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("tab", { name: "Home", exact: true }).click();
      await page.evaluate(() => window.scrollTo(0, 1400));
      const rect = await page.locator(".writer-toolbar-stack").boundingBox();
      assert(rect && rect.y >= 63 && rect.y <= 73, `Formatting toolbar stays below the header at ${width}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `No overflow at ${width}`);
      await page.screenshot({ path: `output/writer-editor/sticky-${width}.png` });
    }
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log("PASS production proxy editor: 33k-character autosave, lost-response recovery, multipart image between paragraphs, indent and width persistence, failed save retry, expired schedule draft save, review submission and 390/768/1440 sticky responsive tools.");
  } finally {
    await browser?.close(); for (const server of servers) server.kill();
    await (await (await import("../lib/storage/mongo")).mongo()).client.close(); await replica.stop();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
