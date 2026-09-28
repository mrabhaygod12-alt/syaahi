import assert from "node:assert/strict";
import { generatePages } from "../lib/jobs/runner";

let calls = 0;
const completePage = `## Retry-safe notes
**Definition:** A retry is a bounded repeat after a transient failure.
### Key points
- It protects a single page from temporary provider failures.
- It changes provider lanes between attempts.
- It never silently accepts an empty response.
- It remains bounded to protect the queue.
### Example / Formula
Try once, then retry a transient request before reporting failure.
### Remember
Check the completed page before moving on.
> Exam alert: unbounded retries can overload a service.
**Summary:** Bounded retries recover transient errors without repeating an entire lesson.`;

async function main() {
  const result = await generatePages(
    ["Provider recovery"],
    "concise",
    undefined,
    async () => {
      calls += 1;
      if (calls === 1) throw new Error("temporary upstream timeout");
      return { text: completePage, provider: "fixture", model: "fixture" };
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.errors.length, 0);
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].provider, "fixture");
  console.log("PASS: a transient single-page provider error retries without failing the lesson.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
