import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
Object.assign(process.env, { APP_ROLE: "all", DATA_BACKEND: "sqlite", MONGODB_URI: "", DATA_DIR: mkdtempSync(join(tmpdir(), "oauth-identity-")), APP_ORIGIN: "https://www.syaahii.in" });
async function main() {
  const { googleAccount } = await import("../lib/auth/oauth"), { register, accountByEmail, originError } = await import("../lib/auth/server"), { authOrigin } = await import("../lib/auth/origin");
  const existing = await register("University Writer", "oauth-fixture@example.test", "fixture-password-safe");
  await assert.rejects(googleAccount({ id: "forged-provider", email: existing.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email" }, user_metadata: { iss: "https://accounts.google.com", email_verified: true } }), /verified Google identity/);
  await assert.rejects(googleAccount({ id: "unconfirmed-email", email: existing.email, app_metadata: { provider: "google" }, user_metadata: { email_verified: true } }), /verified Google identity/);
  const linked = await googleAccount({ id: "trusted-google-subject", email: existing.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "google" } });
  assert.equal(linked.id, existing.id); assert.equal((await accountByEmail(existing.email))!.id, existing.id);
  assert.equal(authOrigin(), "https://www.syaahii.in");
  process.env.APP_ORIGIN = "http://localhost:3161";
  assert.equal(originError(new NextRequest("http://127.0.0.1:3160/api/stories", { method: "POST", headers: { origin: "http://localhost:3161" } })), null);
  assert.equal(originError(new NextRequest("http://127.0.0.1:3160/api/stories", { method: "POST", headers: { origin: "https://attacker.invalid" } }))?.status, 403);
  process.env.APP_ORIGIN = "https://user:secret@example.test"; assert.throws(authOrigin, /valid authentication origin/);
  console.log("PASS: authoritative Google provider and confirmed email only, safe same-email linking, runtime proxy origin and CSRF rejection.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
