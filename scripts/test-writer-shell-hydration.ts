import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
async function main() {
  const origin = "http://localhost:3168",
    dev = process.argv.includes("--dev");
  Object.assign(process.env, {
    DATA_DIR: mkdtempSync(join(tmpdir(), "writer-shell-hydration-")),
    DATA_BACKEND: "sqlite",
    MONGODB_URI: "",
    APP_ROLE: "all",
    BACKEND_URL: "",
    NEXT_DIST_DIR: dev ? ".next-hydration-debug" : ".next-validation",
    NEXT_PUBLIC_APP_URL: origin,
    WORKER_MODE: "external",
  });
  const auth = await import("../lib/auth/server"),
    profiles = await import("../lib/writing/profile"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { setWorkspace } = await import("../lib/workspace-preference");
  const a = await auth.register(
      "Hydration Author",
      "hydrate-author@example.test",
      "safe-fixture-password",
    ),
    b = await auth.register(
      "Hydration Reader",
      "hydrate-reader@example.test",
      "safe-fixture-password",
    );
  for (const u of [a, b]) {
    await markEmailVerified(u.id);
    await profiles.enrollWriter(u);
    await setWorkspace(u.id, "writer");
  }
  const author = await profiles.writerProfile(a.id),
    reader = await profiles.writerProfile(b.id);
  const cookie = (await auth.startSession(b, new Request(origin))).headers
    .get("set-cookie")!
    .split(";")[0];
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      dev ? "dev" : "start",
      "--port",
      "3168",
    ],
    {
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  let browser;
  try {
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(origin + "/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    browser = await chromium.launch();
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "hi-IN",
      timezoneId: "Pacific/Honolulu",
    });
    const [name, value] = cookie.split("=");
    await ctx.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    await ctx.addInitScript(() =>
      localStorage.setItem("syaahi-privacy-v1", "essential"),
    );
    const page = await ctx.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => {
      errors.push(page.url() + ": " + e.message);
      console.error(e.message);
    });
    page.on("console", (m) => {
      if (m.type() === "error" && /hydrat|match|nesting/i.test(m.text()))
        console.error(m.text());
    });
    const session = await ctx.newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.route("**/api/auth", (route) =>
      route.fulfill({ json: { user: { ...b, workspace: "writer" } } }),
    );
    let mismatch = false;
    await page.route("**/api/writer/profile", (route) =>
      route.fulfill({ json: { profile: mismatch ? author : reader } }),
    );
    for (let i = 0; i < 12; i++) {
      mismatch = i % 2 === 0;
      await page.goto(origin + "/writer/profile");
      if (mismatch)
        await page
          .getByRole("alert")
          .filter({ hasText: "profile could not be verified" })
          .waitFor();
      else
        await page
          .getByRole("heading", { name: reader!.name, exact: true, level: 1 })
          .waitFor();
      await page.waitForLoadState("networkidle");
      assert.equal(
        await page
          .getByRole("heading", { name: author!.name, exact: true, level: 1 })
          .count(),
        0,
      );
      assert.deepEqual(
        errors,
        [],
        "Hydration errors after fast profile response",
      );
    }
    console.log(
      "PASS writer shell hydration: fast account/profile responses, wrong-owner gate and repeated private navigation at 4x CPU slowdown with a different locale/timezone.",
    );
  } finally {
    await browser?.close();
    server.kill();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
