/** Browser workflow test with a simulated gateway; never sends a real payment. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

async function main() {
  const base = "http://localhost:3130";
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3130"],
    {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        APP_ROLE: "all",
        BACKEND_URL: "",
        NEXT_PUBLIC_APP_URL: base,
      },
    },
  );
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(base + "/pricing")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    assert(ready, "Production server must start");
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    let created = 0;
    let paid = false;
    const summary = () => ({
      id: "order_BrowserTest",
      pack: "try",
      amount: 900,
      credits: 3,
      paid,
      paymentId: paid ? "pay_BrowserTest" : null,
    });
    await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "window.Razorpay = class { constructor(options) { this.options=options; window.testCheckout=this; } on(name, fn) { this[name]=fn; } open() {} };",
      }),
    );
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body: unknown = {};
      if (path === "/api/credits") body = { balance: 19 };
      if (path === "/api/razorpay/order") {
        assert.equal(route.request().postDataJSON().pack, "try");
        created++;
        body = {
          orderId: "order_BrowserTest",
          keyId: "rzp_test_browser",
          amount: 900,
          credits: 3,
          currency: "INR",
          testMode: true,
        };
      }
      if (path === "/api/razorpay/verify") {
        assert.equal(
          route.request().postDataJSON().razorpay_order_id,
          "order_BrowserTest",
        );
        paid = true;
        body = { ok: true, balance: 22 };
      }
      if (path === "/api/razorpay/orders") body = { orders: [summary()] };
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.goto(base + "/pricing");
    await page.getByRole("button", { name: "Buy Try", exact: true }).click();
    await page.waitForURL("**/checkout/try");
    await page
      .getByRole("button", { name: "Pay ₹9 with Razorpay", exact: true })
      .click();
    await page.waitForFunction(() => Boolean((window as any).testCheckout));
    await page.evaluate(() =>
      (window as any).testCheckout.options.modal.ondismiss(),
    );
    await page.getByText("Checkout closed.", { exact: false }).waitFor();
    mkdirSync("output/qa/payments", { recursive: true });
    await page.screenshot({
      path: "output/qa/payments/checkout-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Continue payment", exact: true })
      .click();
    assert.equal(created, 1, "Reopening checkout reuses the saved order");
    await page.evaluate(() =>
      (window as any).testCheckout.options.handler({
        razorpay_order_id: "order_BrowserTest",
        razorpay_payment_id: "pay_BrowserTest",
        razorpay_signature: "test",
      }),
    );
    await page.waitForURL("**/payments/order_BrowserTest");
    await page.getByRole("heading", { name: "Payment confirmed." }).waitFor();
    await page.screenshot({
      path: "output/qa/payments/confirmed-desktop.png",
      fullPage: true,
    });
    paid = false;
    await page.goto(base + "/payments/order_BrowserTest?success=true");
    await page.getByText("Awaiting confirmation", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("heading", { name: "Payment confirmed." }).count(),
      0,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "output/qa/payments/pending-mobile.png",
      fullPage: true,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "Payment page should fit mobile width",
    );
    await page.goto(base + "/payments");
    await page
      .getByRole("heading", { name: "Your Razorpay purchases" })
      .waitFor();
    console.log(
      "PASS browser payment flow: pricing, checkout, dismiss/reuse, verification, server-confirmed status, forged success URL ignored, history and mobile layout.",
    );
  } finally {
    await browser?.close();
    server.kill();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
