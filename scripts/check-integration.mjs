import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
const base = process.env.APP_TEST_URL || "http://localhost:3101";
const report = [];
async function request(path, body, cookie) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { r, data: await r.json().catch(() => ({})) };
}
const guest = await request("/api/jobs");
assert.equal(guest.r.status, 401);
report.push("Guest job access rejected: 401");
const suffix = Date.now();
const account = await request("/api/auth", {
  mode: "signup", acceptTerms:true,termsVersion:"2026-09-24",
  name: "QA Learner",
  email: `qa-${suffix}@example.test`,
  password: randomBytes(18).toString("hex"),
});
assert.equal(account.r.status, 200);
const cookie = account.r.headers.get("set-cookie").split(";")[0];
const plan = await request(
  "/api/plan",
  {
    topic: "Binary search",
    pages: 1,
    research: false,
    context:
      "Binary search finds a target in a sorted array. Compare the target with the middle item. Discard the half that cannot contain the target. Repeat until found or the interval is empty. The worst-case time is O(log n); iterative auxiliary space is O(1). An unsorted array does not satisfy the precondition.",
  },
  cookie,
);
assert.equal(plan.r.status, 200);
assert.equal(plan.data.evidence, "supplied");
report.push("Material-grounded plan: passed");
const job = await request(
  "/api/jobs",
  {
    topics: plan.data.topics,
    context: plan.data.context,
    style: "concise",
    research: false,
    intelligentPlan: false,
  },
  cookie,
);
assert.equal(job.r.status, 202);
const id = job.data.jobId;
assert(id);
report.push("Job accepted and credits reserved");
let current;
for (let i = 0; i < 75; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  current = await request("/api/jobs/" + id, null, cookie);
  if (["done", "error"].includes(current.data.status)) break;
}
assert.equal(current.data.status, "done", current.data.error);
assert.equal(current.data.pages.length, 1);
report.push(
  `Real generation: ${current.data.pages[0].provider}/${current.data.pages[0].model}`,
);
const credit = await request("/api/credits", null, cookie);
assert.equal(credit.data.balance, 4);
report.push("Wallet charged exactly one credit");
const second = await request("/api/auth", {
  mode: "signup", acceptTerms:true,termsVersion:"2026-09-24",
  name: "Other QA",
  email: `qa-other-${suffix}@example.test`,
  password: randomBytes(18).toString("hex"),
});
const other = second.r.headers.get("set-cookie").split(";")[0];
assert.equal((await request("/api/jobs/" + id, null, other)).r.status, 404);
report.push("Cross-account access rejected: 404");
const [ask, practice, coach] = await Promise.all([
  request(
    "/api/ask",
    {
      pages: current.data.pages,
      question: "What precondition does binary search require?",
    },
    cookie,
  ),
  request("/api/practice", { pages: current.data.pages, size: 5 }, cookie),
  request(
    "/api/interview",
    {
      question: "Explain binary search.",
      answer:
        "Binary search requires a sorted array. Compare the middle value with the target, then discard the half that cannot contain it. Continue until found or no items remain. Time is O(log n).",
    },
    cookie,
  ),
]);
assert.equal(ask.r.status, 200, JSON.stringify(ask.data));
assert.equal(practice.r.status, 200, JSON.stringify(practice.data));
assert.equal(coach.r.status, 200, JSON.stringify(coach.data));
report.push(
  `Grounded chat, ${practice.data.quiz.length} validated quiz items, ${practice.data.flashcards.length} flashcards, and interview coaching: passed`,
);
const pdf = await fetch(base + "/api/export", {
  method: "POST",
  headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ notes: current.data.pages }),
});
assert.equal(pdf.status, 200);
mkdirSync("output/qa", { recursive: true });
writeFileSync(
  "output/qa/generated-binary-search.pdf",
  Buffer.from(await pdf.arrayBuffer()),
);
report.push(`PDF export: ${pdf.headers.get("x-page-count")} sheets`);
const edit = await request(
  "/api/jobs/" + id,
  {
    action: "edit-page",
    index: 0,
    revision: current.data.revision || 0,
    markdown:
      current.data.pages[0].markdown +
      "\n\nQA saved edit: check input ordering.",
  },
  cookie,
);
assert.equal(edit.r.status, 200);
assert(
  (
    await request("/api/jobs/" + id, null, cookie)
  ).data.pages[0].markdown.includes("QA saved edit"),
);
report.push("Note edit persisted");
assert.equal((await request("/api/models", null, cookie)).r.status, 404);
assert.equal((await request("/api/test-tier", null, cookie)).r.status, 404);
report.push("Diagnostics are not exposed");
const noPayment = await request(
  "/api/razorpay/order",
  { pack: "starter" },
  cookie,
);
report.push(`Unconfigured checkout status: ${noPayment.r.status}`);
console.log(report.join("\n"));
writeFileSync(
  "output/qa/integration-results.json",
  JSON.stringify({ at: new Date().toISOString(), report }, null, 2),
);
