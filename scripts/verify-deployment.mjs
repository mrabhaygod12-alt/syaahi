// Public production checks only: no login, writes, generated jobs or payments.
const at = process.argv.indexOf("--commit");
const expected = at >= 0 ? process.argv[at + 1]?.toLowerCase() : null;
if (at >= 0 && !/^[a-f0-9]{40}$/.test(expected || ""))
  throw new Error("--commit requires a full Git SHA.");
const origin = "https://www.syaahii.in";
const checks = [
  ["/", 200, "growth-landing"],
  ["/writing", 200, "writer-public-landing"],
  ["/syaahi", 200, "Syaahi: learn, present and publish."],
  ["/writing/features", 200, "A complete home for your writing."],
  ["/writing/pricing", 200, "Two writer plans."],
  ["/writing/medium-comparison", 200, "Choose the tools your writing needs."],
  ["/ai-presentations", 200, "Build a story your audience can follow."],
  ["/product-facts.json", 200, '"Write & publish"'],
  ["/feed.xml", 200, "Syaahi reviewed stories"],
  ["/llms.txt", 200, "exactly Free and Max ₹399"],
  ["/subscribe/pro", 307, undefined, "/pricing"],
  ["/writer/subscribe/starter", 307, undefined, "/writer/membership"],
  ["/writer/welcome", 200],
  ["/writer/membership", 200],
  ["/writer/support", 200],
  ["/pricing", 200],
  ["/hi", 200, "विश्वविद्यालय"],
  ["/resources", 200, "revision"],
  ["/examples?sample=dbms", 200, "Normalization"],
  ["/subjects/computer-science", 200, "STARTER TOPIC"],
  ["/api/admin/growth", 403],
  ["/presentations", 200],
  ["/api/jobs", 401],
  ["/api/writer/profile", 401],
  ["/api/writer/discovery", 401],
  ["/api/presentations", 401],
  ["/api/student/hub", 401],
  ["/api/credits/ledger", 401],
  ["/api/admin/security", 403],
  ["/api/admin/users", 403],
  ["/api/admin/support", 403],
  ["/api/admin/overview", 403],
  ["/api/admin/mfa", 403],
  ["/api/user/sessions", 401],
  ["/api/presentations/sources", 401],
];
const results = await Promise.all(
  checks.map(async ([path, status, marker, redirect]) => {
    const started = Date.now();
    try {
      const response = await fetch(origin + path, {
        ...(redirect ? { redirect: "manual" } : {}),
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
          (!redirect ||
            new URL(response.headers.get("location") || "", origin).href ===
              origin + redirect) &&
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
      billing.subscription === null &&
      JSON.stringify(
        Object.values(billing.plans || {}).map((plan) => plan.inr),
      ) === JSON.stringify([399]),
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
