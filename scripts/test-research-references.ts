import assert from "node:assert/strict";
import { topicReadingLinks, wikipediaReferences } from "../lib/research";

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

console.log(
  "PASS topic-specific outbound reading links and strict Wikipedia source URL validation.",
);
