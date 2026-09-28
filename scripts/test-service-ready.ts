import assert from "node:assert/strict";
import { waitForService } from "../lib/service-ready";

async function main() {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (path, init) => {
      assert.equal(path, "/api/health");
      assert.ok(!init?.method || init.method === "GET");
      calls++;
      if (calls === 1)
        return new Response("<!doctype html>Starting", { status: 502 });
      if (calls === 2) return Response.json({ ok: false }, { status: 503 });
      if (calls === 3) return Response.json({ ok: true, app: "other" });
      return Response.json({ ok: true, app: "syaahi", mongo: true });
    };
    await waitForService(undefined, { timeoutMs: 1000, intervalMs: 1 });
    assert.equal(calls, 4);
    globalThis.fetch = async () => new Response("Unavailable", { status: 502 });
    await assert.rejects(
      waitForService(undefined, { timeoutMs: 15, intervalMs: 1 }),
      /login was not submitted/,
    );
    const controller = new AbortController();
    globalThis.fetch = async () => {
      controller.abort();
      return Response.json({ ok: false }, { status: 503 });
    };
    await assert.rejects(
      waitForService(controller.signal, { timeoutMs: 1000, intervalMs: 1 }),
      /cancelled/,
    );
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ error: "Forbidden" }, { status: 403 });
    };
    await assert.rejects(
      waitForService(undefined, { timeoutMs: 1000, intervalMs: 1 }),
      /login was not submitted/,
    );
    assert.equal(calls, 1);
    console.log(
      "PASS: cold-start HTML/503 recovery, correct service identity, bounded outage, cancellation and fail-fast access errors. Health GET only; no login POST replay.",
    );
  } finally {
    globalThis.fetch = original;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
