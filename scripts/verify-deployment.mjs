// Public production checks only: no login, writes, generated jobs or payments.
const at = process.argv.indexOf("--commit");
const expected = at >= 0 ? process.argv[at + 1]?.toLowerCase() : null;
if (at >= 0 && !/^[a-f0-9]{40}$/.test(expected || ""))
  throw new Error("--commit requires a full Git SHA.");
const origin = "https://www.syaahii.in";
const checks = [
  ["/", 200, "landing-page"],
  ["/writing", 200, "writer-public-landing"],
  ["/writer/welcome", 200],
  ["/writer/membership", 200],
  ["/writer/support", 200],
  ["/pricing", 200],
  ["/presentations", 200],
  ["/api/jobs", 401],
  ["/api/writer/profile", 401],
  ["/api/presentations", 401],
  ["/api/student/hub", 401],
  ["/api/credits/ledger", 401],
  ["/api/admin/security", 403],
  ["/api/presentations/sources", 401],
];
const results = await Promise.all(
  checks.map(async ([path, status, marker]) => {
    const started = Date.now();
    try {
      const response = await fetch(origin + path, {
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
      });
      const body = marker ? await response.text() : null;
      const revision = response.headers.get("x-syaahi-frontend-revision");
      return {
        path,
        status: response.status,
        ms: Date.now() - started,
        revision,
        passed:
          response.status === status &&
          (!marker || body.includes(marker)) &&
          (!expected || revision === expected),
      };
    } catch {
      return { path, passed: false, error: "unreachable" };
    }
  }),
);
for (const base of [origin, "https://syaahi.onrender.com"]) {
  try {
    const response = await fetch(`${base}/api/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
    const health = await response.json();
    results.push({
      path: `${base}/api/health`,
      status: response.status,
      revision: health.revision || null,
      passed:
        response.ok &&
        health.ok === true &&
        health.mongo === true &&
        health.role === "backend" &&
        (!expected || health.revision === expected),
    });
  } catch {
    results.push({
      path: `${base}/api/health`,
      passed: false,
      error: "unreachable",
    });
  }
}
try {
  const response = await fetch(`${origin}/api/billing/subscription`, {
    cache: "no-store",
    signal: AbortSignal.timeout(45000),
  });
  const billing = await response.json();
  results.push({
    path: "/api/billing/subscription",
    status: response.status,
    available: billing.available,
    passed:
      response.ok &&
      billing.authenticated === false &&
      billing.subscription === null,
  });
  // Availability is configuration metadata, not proof of provider authentication or settlement.
} catch {
  results.push({
    path: "/api/billing/subscription",
    passed: false,
    error: "unreachable",
  });
}
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      expectedCommit: expected,
      checks: results,
    },
    null,
    2,
  ),
);
console.log(
  "Public smoke checks only. Authenticated journeys, worker completion and payment settlement require separate checks.",
);
if (results.some((result) => !result.passed)) process.exitCode = 1;
