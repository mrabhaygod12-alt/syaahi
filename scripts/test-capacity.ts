import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-capacity-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.APP_ROLE = "all";
process.env.WORKER_MODE = "external";
process.env.MAX_ACTIVE_JOBS_PER_USER = "2";
async function main() {
  let replica: any;
  let server: ReturnType<typeof spawn> | undefined;
  try {
    if (process.argv.includes("--mongo")) {
      const { MongoMemoryReplSet } = await import("mongodb-memory-server");
      replica = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
        binary: { version: "8.0.12" },
      });
      process.env.MONGODB_URI = replica.getUri();
      process.env.DATA_BACKEND = "mongo";
      process.env.MONGODB_DATABASE = "capacity_test";
    }
    const { register } = await import("../lib/auth/server");
    const { createJob } = await import("../lib/jobs/store");
    const { balance } = await import("../lib/credits/store");
    const { QueueCapacityError, boundedSetting } =
      await import("../lib/jobs/capacity");
    process.env.TEST_BOUND = "-8";
    assert.equal(boundedSetting("TEST_BOUND", 2, 1, 4), 2);
    const user = await register(
      "Capacity QA",
      "capacity@example.test",
      "test-password-12345",
    );
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        createJob(user.id, ["Evidence"], "concise"),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
    for (const r of results)
      if (r.status === "rejected")
        assert(r.reason instanceof QueueCapacityError);
    assert.equal(
      await balance(user.id),
      19,
      "rejected requests must not reserve credits",
    );
    console.log(
      `PASS: ${process.env.DATA_BACKEND} six competing requests admit exactly two jobs; rejected reservations roll back.`,
    );
    if (replica) return;
    const base = "http://localhost:3118";
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "--port", "3118"],
      { env: process.env, stdio: "ignore", windowsHide: true },
    );
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    const login = await fetch(base + "/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "login",
        email: "capacity@example.test",
        password: "test-password-12345",
        acceptTerms: true,
        termsVersion: "2026-09-24",
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const timings: number[] = [];
    let failures = 0;
    const start = performance.now();
    for (let batch = 0; batch < 5; batch++)
      await Promise.all(
        Array.from({ length: 20 }, async () => {
          const t = performance.now();
          const r = await fetch(base + "/api/credits", { headers: { cookie } });
          if (!r.ok) failures++;
          await r.arrayBuffer();
          timings.push(performance.now() - t);
        }),
      );
    timings.sort((a, b) => a - b);
    const report = {
      environment:
        "local production build / SQLite / authenticated read endpoint; not a production or AI capacity benchmark",
      requests: 100,
      concurrency: 20,
      failures,
      elapsedMs: Math.round(performance.now() - start),
      p50Ms: Math.round(timings[49]),
      p95Ms: Math.round(timings[94]),
    };
    assert.equal(failures, 0);
    mkdirSync("output/qa", { recursive: true });
    writeFileSync(
      "output/qa/capacity-smoke.json",
      JSON.stringify(report, null, 2),
    );
    console.log(report);
  } finally {
    server?.kill();
    if (replica) {
      const { mongo } = await import("../lib/storage/mongo");
      await (await mongo()).client.close();
      await replica.stop();
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
