import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-reward-ui-"));
process.env.MONGODB_URI = "";
process.env.DATA_BACKEND = "sqlite";
process.env.APP_ROLE = "all";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3112";
process.env.RESEND_API_KEY = "";
const base = "http://localhost:3112";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3112"],
  { cwd: process.cwd(), env: process.env, stdio: "ignore", windowsHide: true },
);
async function main() {
  let browser;
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    const signup = async (email: string) => {
      const r = await fetch(base + "/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Reward QA",
          email,
          password: "long-test-password",
          mode: "signup",
          acceptTerms: true,
          termsVersion: "2026-09-24",
        }),
      });
      assert.equal(r.status, 200);
      return {
        user: (await r.json()).user,
        cookie: r.headers.get("set-cookie")!.split(";")[0],
      };
    };
    const owner = await signup("owner-ui@example.test"),
      friend = await signup("friend-ui@example.test");
    const get = async (path: string, cookie: string) => {
      const r = await fetch(base + path, { headers: { cookie } });
      return r.json();
    };
    const post = async (path: string, cookie: string, body: object) =>
      fetch(base + path, {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    assert.equal((await get("/api/credits", owner.cookie)).balance, 21);
    const ref = await get("/api/referrals", owner.cookie);
    assert.equal(
      (await post("/api/referrals", friend.cookie, { code: ref.code })).status,
      200,
    );
    const { issueVerification } = await import("../lib/auth/verification");
    const token = await issueVerification(friend.user.id);
    assert.equal(
      (await post("/api/auth/verify-email", owner.cookie, { token: "0".repeat(64) })).status,
      400,
    );
    assert.equal(
      (await post("/api/auth/verify-email", friend.cookie, { token })).status,
      200,
    );
    assert.equal((await get("/api/referrals", owner.cookie)).rewardBalance, 5);
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const separator = owner.cookie.indexOf("=");
    await page
      .context()
      .addCookies([
        {
          name: owner.cookie.slice(0, separator),
          value: owner.cookie.slice(separator + 1),
          url: base,
        },
      ]);
    await page.goto(base + "/refer");
    await page
      .getByRole("button", { name: "Add 5 credits to study balance" })
      .click();
    await page
      .getByText("Reward credits added to your study balance.", { exact: true })
      .waitFor();
    assert.equal((await get("/api/credits", owner.cookie)).balance, 26);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: "output/qa/rewards-mobile.png",
      fullPage: true,
    });
    await page.goto(base + "/about");
    await page
      .locator(".about-hero")
      .getByText("Manish Kumar Singh", { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "output/qa/creators-desktop.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: production HTTP signup21, invalid verification token rejection, reward5, mobile transfer to26, creator intro and no browser errors.",
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
