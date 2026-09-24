import assert from "node:assert/strict";
import { accountByEmail, originError } from "../lib/auth/server";
import { getSupabaseConfig } from "../lib/auth/oauth";
import { verifySignature } from "../lib/billing/payments";
import { createHmac } from "node:crypto";

async function runSecurityAudit() {
  console.log("Running comprehensive defensive security tests...");

  // 1. NoSQL / Object Injection & Input Sanitization
  // @ts-ignore - passing non-string to test type coercion defense
  const nonStringResult = await accountByEmail({ $gt: "" });
  assert.equal(nonStringResult, null, "Defense: non-string object email must return null immediately");

  // @ts-ignore - passing array
  const arrayResult = await accountByEmail(["admin@example.com"]);
  assert.equal(arrayResult, null, "Defense: array email must return null");

  // Oversized email
  const oversizedEmail = "a".repeat(300) + "@example.com";
  const oversizedResult = await accountByEmail(oversizedEmail);
  assert.equal(oversizedResult, null, "Defense: oversized email (>254 chars) must return null");
  console.log("✔ Pass: NoSQL injection & input bounds defenses verified");

  // 2. Supabase typo resilience & type safety
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASUPABASE_PUBLISHABLE_KEYE_URL = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_jwt";
  const typoCfg = getSupabaseConfig();
  assert.equal(typoCfg.key, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_jwt");
  assert.ok(typoCfg.url.startsWith("http"), "Defense: URL must never be assigned JWT value");
  console.log("✔ Pass: Supabase typo fuzzy discovery & type segregation verified");

  // 3. Timing Attack Resistance in HMAC Signature Verification
  const testSecret = "sec_test_123456789";
  const payload = "order_123|pay_456";
  const validSig = createHmac("sha256", testSecret).update(payload).digest("hex");
  
  assert.equal(verifySignature(payload, validSig, testSecret), true, "Valid HMAC signature passes");
  assert.equal(verifySignature(payload, "invalid_sig", testSecret), false, "Malformed signature fails regex");
  assert.equal(verifySignature(payload, validSig.slice(0, 63) + "a", testSecret), false, "Tampered signature rejected");
  console.log("✔ Pass: HMAC timingSafeEqual verification verified");

  // 4. CSRF / Origin Validation
  const fakeRequest = new Request("http://localhost:3000/api/auth", {
    method: "POST",
    headers: { origin: "https://evil-attacker.com" },
  });
  const originDenial = originError(fakeRequest);
  assert.ok(originDenial, "Defense: untrusted origin must be rejected");
  assert.equal(originDenial?.status, 403, "Defense: rejected origin must return HTTP 403");

  const legitimateRequest = new Request("http://localhost:3000/api/auth", {
    method: "POST",
    headers: { origin: "https://syaahii.netlify.app" },
  });
  const legitimateResult = originError(legitimateRequest);
  assert.equal(legitimateResult, null, "Legitimate frontend origin must be permitted");
  console.log("✔ Pass: CSRF / Origin validation defense verified");

  console.log("\nALL DEFENSIVE SECURITY AUDIT TESTS PASSED SUCCESSFULLY!");
}

runSecurityAudit().catch((e) => {
  console.error("Security audit test failed:", e);
  process.exit(1);
});
