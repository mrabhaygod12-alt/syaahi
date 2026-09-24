import assert from "node:assert/strict";
import { eligibleProviders, PROVIDER_BASE_URL } from "../lib/ai/providers";
process.env.APINEX_API_KEY = "test-only-not-a-credential";
process.env.OPENCODE_API_KEY = "test-only-not-a-credential";
process.env.ENABLE_APINEX = "false";
process.env.ENABLE_ZEN_API = "false";
assert(!eligibleProviders().some((p) => ["apinex", "zen"].includes(p.type)));
process.env.ENABLE_APINEX = "true";
process.env.ENABLE_ZEN_API = "true";
const candidates = eligibleProviders();
assert.equal(PROVIDER_BASE_URL.apinex, "https://api.apinex.bond/v1");
assert(candidates.some((p) => p.model === "free/glm-5.3-flash"));
assert(candidates.some((p) => p.model === "space-bunny-free"));
assert(!candidates.some((p) => p.model === "free/muse-spark-1.3"));
assert(
  candidates
    .filter((p) => p.type === "apinex")
    .every((p) => p.model.startsWith("free/")),
);
console.log(
  "PASS: gateway opt-in controls, corrected endpoint and free-model catalog. No network inference performed.",
);
