import assert from "node:assert/strict";
import {
  enforceRequestBudget,
  RequestBudgetError,
} from "../lib/security/request-budget";
async function main() {
  const slow = new Request("https://www.syaahii.in/api/test", {
    method: "POST",
    body: new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array([123]));
      },
    }),
    duplex: "half",
  } as RequestInit);
  await assert.rejects(
    enforceRequestBudget(slow, { timeoutMs: 40 }),
    (e) => e instanceof RequestBudgetError && e.status === 408,
  );
  const chunked = new Request("https://www.syaahii.in/api/test", {
    method: "POST",
    body: "123456",
  });
  await assert.rejects(
    enforceRequestBudget(chunked, { limit: 4 }),
    (e) => e instanceof RequestBudgetError && e.status === 413,
  );
  const auth = new Request("https://www.syaahii.in/api/auth", {
    method: "POST",
    body: "x".repeat(65537),
  });
  await assert.rejects(
    enforceRequestBudget(auth),
    (e) => e instanceof RequestBudgetError && e.status === 413,
  );
  const valid = new Request("https://www.syaahii.in/api/test", {
    method: "POST",
    body: '{"ok":true}',
  });
  await enforceRequestBudget(valid);
  assert.deepEqual(await valid.json(), { ok: true });
  const invalid = new Request("https://www.syaahii.in/api/test", {
    method: "POST",
    headers: { "Content-Length": "-3" },
  });
  await assert.rejects(
    enforceRequestBudget(invalid),
    (e) => e instanceof RequestBudgetError && e.status === 400,
  );
  console.log(
    "PASS bounded slow/chunked uploads, auth budget, invalid length and preserved handler body.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
