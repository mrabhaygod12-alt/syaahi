import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-research-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  BACKEND_URL: "",
});
async function main() {
  const { register, startSession } = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { balance } = await import("../lib/credits/store"),
    { POST } = await import("../app/api/presentations/research/route");
  const user = await register(
    "CS research fixture",
    "research-fixture@example.test",
    "safe-fixture-password",
  );
  await markEmailVerified(user.id);
  const cookie = (
    await startSession(user, new Request("http://localhost:3199"))
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const request = (query: string, authenticated = true) =>
    new NextRequest("http://localhost:3199/api/presentations/research", {
      method: "POST",
      headers: {
        ...(authenticated ? { cookie } : {}),
        origin: "http://localhost:3199",
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
  assert.equal((await POST(request("normalization", false))).status, 401);
  assert.equal((await POST(request("x"))).status, 400);
  assert.equal((await POST(request("x".repeat(161)))).status, 400);
  const before = await balance(user.id),
    original = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://en.wikipedia.org");
      assert.equal(url.pathname, "/w/api.php");
      assert.equal(url.searchParams.get("gsrsearch"), "database normalization");
      return new Response(
        JSON.stringify({
          query: {
            pages: {
              1: {
                title: "Database normalization",
                fullurl: "https://en.wikipedia.org/wiki/Database_normalization",
                extract: "Original encyclopedia evidence. ".repeat(100),
              },
              2: {
                title: "Unsafe response URL",
                fullurl: "https://evil.example/wiki/Private",
                extract: "Untrusted URL should be excluded. ".repeat(10),
              },
              3: {
                title: "Credential URL",
                fullurl: "https://name:secret@en.wikipedia.org/wiki/Private",
                extract: "Untrusted credentials should be excluded. ".repeat(
                  10,
                ),
              },
            },
          },
        }),
        { status: 200 },
      );
    };
    const response = await POST(request("database normalization")),
      data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "Wikipedia");
    assert.equal(data.sources.length, 1);
    assert(data.sources[0].excerpt.length <= 1200);
    assert.equal(
      await balance(user.id),
      before,
      "Discovery never starts a paid deck",
    );
    globalThis.fetch = async () =>
      new Response("upstream unavailable", { status: 503 });
    const empty = await (await POST(request("database normalization"))).json();
    assert.deepEqual(empty.sources, [], "Outage must not invent sources");
  } finally {
    globalThis.fetch = original;
  }
  console.log(
    "PASS presentation research: authenticated fixed-domain discovery, query bounds, original excerpt results, credential/foreign URL rejection, no automatic import/charge, honest empty result.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
