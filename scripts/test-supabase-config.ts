import assert from "node:assert/strict";
import { getSupabaseConfig } from "../lib/auth/oauth";
for (const k of Object.keys(process.env))
  if (k.includes("SUPABASE")) delete process.env[k];
process.env.UNRELATED_SECRET_KEY = "sb_secret_not_oauth";
assert.equal(getSupabaseConfig().key, undefined);
assert.equal(getSupabaseConfig().url, "");
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
process.env.SUPABASE_URL = "https://example.supabase.co/";
assert.deepEqual(getSupabaseConfig(), {
  url: "https://example.supabase.co",
  key: "sb_publishable_test",
});
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_secret_forbidden";
assert.equal(getSupabaseConfig().key, undefined);
process.env.SUPABASE_PUBLISHABLE_KEY =
  "eyJheader." +
  Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url") +
  ".signature";
assert.equal(getSupabaseConfig().key, undefined);
process.env.SUPABASE_PUBLISHABLE_KEY =
  "eyJheader." +
  Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url") +
  ".signature";
assert(getSupabaseConfig().key);
process.env.SUPABASE_PUBLISHABLE_KEY =
  "eyJheader." +
  Buffer.from(
    JSON.stringify({ role: "anon", ref: "wrong-project" }),
  ).toString("base64url") +
  ".signature";
assert.deepEqual(getSupabaseConfig(), {
  url: "https://example.supabase.co",
  key: undefined,
  issue: "Supabase URL and publishable key belong to different projects.",
});
process.env.SUPABASE_PUBLISHABLE_KEY =
  "eyJheader." +
  Buffer.from(
    JSON.stringify({ role: "anon", ref: "example" }),
  ).toString("base64url") +
  ".signature";
assert(getSupabaseConfig().key);
console.log(
  "PASS Supabase config rejects unrelated/service-role keys and detects URL/key project mismatches",
);
