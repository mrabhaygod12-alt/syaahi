import assert from "node:assert/strict";
import { getSupabaseConfig } from "../lib/auth/oauth";

// Clean env
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_URI;
delete process.env.SUPABASE_PUBLISHABLE_KEY;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_KEY;
delete process.env.SUPABASUPABASE_PUBLISHABLE_KEYE_URL;

// Test 1: Simulating user's exact Render typo: "SUPABASUPABASE_PUBLISHABLE_KEYE_URL"
process.env.SUPABASUPABASE_PUBLISHABLE_KEYE_URL = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_jwt";
const conf1 = getSupabaseConfig();
assert.equal(conf1.key, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_jwt");
assert.equal(conf1.url, "https://aoyhbcxvqenijbgjhswg.supabase.co");
console.log("PASS: Typo SUPABASUPABASE_PUBLISHABLE_KEYE_URL correctly detected!");

// Test 2: Standard env key
delete process.env.SUPABASUPABASE_PUBLISHABLE_KEYE_URL;
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_standard_key";
process.env.SUPABASE_URL = "https://custom-project.supabase.co/";
const conf2 = getSupabaseConfig();
assert.equal(conf2.key, "sb_publishable_standard_key");
assert.equal(conf2.url, "https://custom-project.supabase.co");
console.log("PASS: Standard Supabase keys correctly resolved!");
