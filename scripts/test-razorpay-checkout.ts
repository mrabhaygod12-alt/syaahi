/** Optional real Razorpay TEST-key order smoke test. Never captures or charges a payment. */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
async function main() {
  process.loadEnvFile(".env");
  assert(
    process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_"),
    "Only test credentials are permitted",
  );
  // This smoke test uses isolated SQLite state. Keep registration local instead
  // of asynchronously syncing its reserved test address to hosted Supabase.
  for (const name of [
    "SUPABASE_URL",
    "SUPABASE_URI",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URI",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_KEY",
  ])
    delete process.env[name];
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-rzp-test-"));
  process.env.MONGODB_URI = "";
  process.env.DATA_BACKEND = "sqlite";
  process.env.APP_ROLE = "all";
  process.env.BACKEND_URL = "";
  process.env.WORKER_MODE = "external";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3123";
  const { register, startSession } = await import("../lib/auth/server");
  const { balance } = await import("../lib/credits/store");
  const { db } = await import("../lib/db");
  const admin = await register(
    "Checkout test",
    "checkout-smoke@example.test",
    "test-password-12345",
  );
  process.env.PAYMENT_ADMIN_IDS = admin.id;
  const { markEmailVerified } = await import("../lib/billing/rewards");
  await markEmailVerified(admin.id);
  const auth = await startSession(admin, new Request("http://localhost:3123"));
  const cookie = auth.headers.get("set-cookie")!.split(";")[0];
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3123"],
    {
      env: process.env,
      stdio: ["ignore", "ignore", "inherit"],
      windowsHide: true,
    },
  );
  let browser: any;
  try {
    const base = "http://localhost:3123";
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    const post = (path: string, body: unknown) =>
      fetch(base + path, {
        method: "POST",
        headers: { cookie, origin: base, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const missing = await post("/api/razorpay/verify", {});
    assert.equal(missing.status, 400);
    const made = await post("/api/razorpay/order", {
      pack: "try",
      amount: 1,
      credits: 9999,
    });
    const order = await made.json();
    assert.equal(made.status, 200, JSON.stringify(order));
    assert.equal(order.amount, 900);
    assert.equal(order.credits, 3);
    assert.equal(order.testMode, true);
    assert.equal(
      db().prepare("SELECT amount FROM orders WHERE id=?").get(order.orderId)
        ?.amount,
      900,
    );
    const invalid = await post("/api/razorpay/verify", {
      razorpay_order_id: order.orderId,
      razorpay_payment_id: "pay_forged",
      razorpay_signature: "0".repeat(64),
    });
    assert.equal(invalid.status, 400);
    assert.equal(await balance(admin.id), 19);
    console.log(
      "PASS real test gateway order endpoint: provider accepts order, server ignores forged amount/credits, persists order, missing/invalid signatures grant nothing",
    );
    browser = await chromium.launch();
    const context = await browser.newContext();
    const [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    const page = await context.newPage();
    await page.goto(base + "/checkout/try");
    await page
      .getByRole("button", { name: "Pay ₹9 with Razorpay", exact: true })
      .click();
    await page
      .locator("iframe.razorpay-checkout-frame")
      .waitFor({ state: "visible", timeout: 30000 });
    console.log(
      "PASS real Razorpay Standard Checkout modal opens with server order (no payment submitted)",
    );
  } finally {
    await browser?.close();
    server.kill();
    db().close();
  }
}
main().catch((e) => {
  console.error(
    "Checkout smoke test failed:",
    e instanceof Error ? e.message : "Error",
  );
  process.exitCode = 1;
});
