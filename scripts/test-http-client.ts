import assert from "node:assert/strict";
import { requestJson } from "../lib/http-client";
import { paymentConfiguration } from "../lib/billing/configuration";

async function main() {
  const original = globalThis.fetch;
  try {
    for (const [status, body] of [
      [502, "<!DOCTYPE html><h1>Render unavailable</h1>"],
      [200, "<html>Sign in</html>"],
      [200, "null"],
      [200, "[]"],
    ] as const) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return new Response(body, { status });
      };
      await assert.rejects(
        requestJson("/api/auth", { method: "POST" }),
        /could not reach its service/,
      );
      assert.equal(calls, 1, "Mutations must never be automatically retried");
    }
    globalThis.fetch = async () =>
      Response.json(
        {
          error: "Verify your email",
          requireVerification: true,
          verifyUrl: "/verify-email",
        },
        { status: 403 },
      );
    const result = await requestJson("/api/auth");
    assert.equal(result.response.status, 403);
    assert.equal(result.data.requireVerification, true);
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await assert.rejects(requestJson("/api/auth"), /Could not connect/);
    globalThis.fetch = async (_, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    await assert.rejects(requestJson("/api/auth", {}, 5), /took too long/);

    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_KEY_ID = "rzp_live_fixture";
    assert.equal(paymentConfiguration().configured, false);
    process.env.RAZORPAY_KEY_SECRET = "fixture-secret";
    assert.equal(paymentConfiguration().configured, false);
    process.env.RAZORPAY_WEBHOOK_SECRET = "fixture-webhook";
    assert.deepEqual(paymentConfiguration(), {
      mode: "live",
      configured: true,
    });
    process.env.RAZORPAY_KEY_ID = "rzp_test_fixture";
    assert.deepEqual(paymentConfiguration(), {
      mode: "test",
      configured: true,
    });
    process.env.RAZORPAY_KEY_ID = "invalid";
    assert.deepEqual(paymentConfiguration(), {
      mode: "unconfigured",
      configured: false,
    });
    console.log(
      "PASS: proxy HTML, malformed JSON, structured auth errors, network timeout, no mutation replay, live/test payment configuration.",
    );
  } finally {
    globalThis.fetch = original;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
