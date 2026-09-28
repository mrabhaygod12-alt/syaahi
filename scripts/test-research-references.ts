import assert from "node:assert/strict";
import {
  researchContext,
  topicReadingLinks,
  wikipediaReferences,
} from "../lib/research";

const technical = topicReadingLinks("JavaScript data structures");
assert(technical.some((item) => item.title === "Search GeeksforGeeks"));
assert(technical.some((item) => item.title === "Search W3Schools"));
for (const item of technical) {
  const url = new URL(item.url);
  assert.equal(url.origin, "https://www.google.com");
  assert(url.searchParams.get("q")?.includes("JavaScript data structures"));
}
assert.deepEqual(topicReadingLinks("The French Revolution"), []);

const references = wikipediaReferences([
  { title: "Safe article", url: "https://en.wikipedia.org/wiki/Example" },
  { title: "External", url: "https://example.com/article" },
  { title: "Wrong protocol", url: "http://en.wikipedia.org/wiki/Example" },
]);
assert.equal(references.length, 1);
assert.equal(references[0].title, "Safe article");

const bundle = researchContext(
  [
    {
      id: "S1",
      title: "First topic source",
      url: "https://en.wikipedia.org/wiki/Example",
      excerpt: "First source evidence.",
      retrievedAt: "2026-09-28T00:00:00.000Z",
    },
    {
      id: "S2",
      title: "Second topic source",
      url: "https://en.wikipedia.org/wiki/Another_example",
      excerpt: "Second source evidence.",
      retrievedAt: "2026-09-28T00:00:00.000Z",
    },
  ],
  "Learner's own notes.",
);
assert(bundle.includes("[S1] First topic source"));
assert(bundle.includes("[S2] Second topic source"));
assert(bundle.includes("[USER MATERIAL]"));
assert(bundle.includes("Learner's own notes."));

console.log(
  "PASS topic-specific outbound reading links and strict Wikipedia source URL validation.",
);
