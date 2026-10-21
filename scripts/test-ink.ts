import { strict as assert } from "node:assert";
import { segment, shingles, tokens, wordCount } from "../lib/ink/text";
import { analyseStyle } from "../lib/ink/style";
import { matchSources, searchExcerpts, type SourceDocument } from "../lib/ink/match";
import { auditCitations } from "../lib/ink/citations";

let checks = 0;
function ok(label: string, fn: () => void) {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
}

// ---------------------------------------------------------------- segmentation
ok("splits sentences on terminators", () => {
  const doc = segment(
    "Water boils at 100 °C. The kettle was loud! Was it broken? It was not.",
  );
  assert.equal(doc.sentences.length, 4);
  assert.equal(doc.sentences[0].text, "Water boils at 100 °C.");
  assert.equal(doc.sentences[2].text, "Was it broken?");
});

ok("keeps abbreviations inside a sentence", () => {
  const doc = segment("Dr. Rao met Prof. Iyer at 3.5 km from St. Mary's. They left.");
  assert.equal(doc.sentences.length, 2, JSON.stringify(doc.sentences.map((s) => s.text)));
});

ok("does not split decimals", () => {
  const doc = segment("The yield rose 3.5 percent in 2024. It held.");
  assert.equal(doc.sentences.length, 2);
  assert.match(doc.sentences[0].text, /3\.5 percent/);
});

ok("handles initials", () => {
  const doc = segment("The study by J. K. Rowling was cited. Nobody read it.");
  assert.equal(doc.sentences.length, 2, JSON.stringify(doc.sentences.map((s) => s.text)));
});

ok("treats a blank line as a paragraph break", () => {
  const doc = segment("First para here.\n\nSecond para here.");
  assert.equal(doc.paragraphs.length, 2);
  assert.equal(doc.sentences[0].paragraph, 0);
  assert.equal(doc.sentences[1].paragraph, 1);
});

ok("sentence offsets point at real text", () => {
  const text = "One two three. Four five six.";
  const doc = segment(text);
  for (const s of doc.sentences) assert.equal(text.slice(s.start, s.end), s.text);
});

ok("sentence array always terminates", () => {
  const doc = segment("no terminator at all");
  assert.equal(doc.sentences.length, 1);
});

ok("counts words", () => {
  assert.equal(wordCount("the quick brown fox"), 4);
  assert.equal(wordCount("don't stop-believing now"), 3);
});

// -------------------------------------------------------------------- shingles
ok("builds overlapping n-grams", () => {
  const s = shingles("a b c d e f g h i", 8);
  assert.equal(s.size, 2);
  assert.ok(s.has("a b c d e f g h"));
  assert.ok(s.has("b c d e f g h i"));
});

ok("tokenises without punctuation", () => {
  assert.deepEqual(tokens("Hello, world! It's fine."), ["hello", "world", "it's", "fine"]);
});

// ----------------------------------------------------------------------- style
const AI_ISH = `It is important to note that artificial intelligence plays a crucial role in modern education. In today's fast-paced world, students must navigate the complexities of digital learning environments. Furthermore, AI-powered tools facilitate a comprehensive understanding of complex subjects. Moreover, these systems leverage cutting-edge algorithms to deliver personalized feedback. Additionally, they utilize robust data analysis to identify learning gaps. Consequently, educators can make highly significant improvements to their teaching methods. In conclusion, AI serves as a testament to the ever-evolving landscape of education and will continue to revolutionize the sector.`;

const HUMAN_ISH = `I ran the same quiz twice with my class, once on paper and once through the app. The paper group finished in eleven minutes. The app group took nineteen, which surprised me. Three students in the app group asked what "submit" meant, and two of them had already lost their answers when the page reloaded on a weak connection. That is not a technology problem, it is a wording problem, and it took a broken Tuesday to see it.`;

ok("flags formulaic AI-style prose", () => {
  const report = analyseStyle(AI_ISH);
  assert.ok(report.footprint >= 45, `expected elevated footprint, got ${report.footprint}`);
  assert.equal(report.band === "clear", false);
  assert.ok(
    report.spans.some((s) => /Formulaic|stock/i.test(s.reason)),
    "should point at stock phrasing",
  );
});

ok("clears concrete human-style prose", () => {
  const report = analyseStyle(HUMAN_ISH);
  assert.ok(report.footprint < 45, `expected clear footprint, got ${report.footprint}`);
});

ok("every signal is explainable", () => {
  const report = analyseStyle(AI_ISH);
  for (const s of report.signals) {
    assert.ok(s.label.length > 0 && s.reading.length > 0 && s.why.length > 0);
    assert.ok(s.value >= 0 && s.value <= 100);
  }
});

ok("reports real sentence statistics", () => {
  const report = analyseStyle(HUMAN_ISH);
  assert.ok(report.sentenceStats.mean > 0);
  assert.ok(report.sentenceStats.max >= report.sentenceStats.min);
  assert.equal(report.sentences, 5);
});

ok("handles very short input without crashing", () => {
  const report = analyseStyle("Too short.");
  assert.ok(report.signals.length === 6);
  assert.ok(report.footprint >= 0);
});

// ------------------------------------------------------------------- matching
const SOURCE_TEXT =
  "Machine learning models require substantial amounts of labelled training data to generalise well. When the training set is small or biased the resulting model tends to reproduce those biases at inference time. Researchers have therefore explored semi supervised approaches that combine a small labelled set with a much larger unlabelled corpus.";

ok("finds a verbatim copied run", () => {
  const submission =
    "My chapter covers several topics. Machine learning models require substantial amounts of labelled training data to generalise well. I then discuss evaluation.";
  const source: SourceDocument = {
    id: "s1",
    title: "Source",
    kind: "web",
    text: SOURCE_TEXT,
  };
  const result = matchSources(submission, [source]);
  assert.equal(result.sourceCount, 1);
  assert.ok(result.matchedWords >= 12, `matched ${result.matchedWords}`);
  assert.ok(result.coverage > 0.2);
});

ok("does not flag a shared topic with different wording", () => {
  const submission =
    "Training a model needs a lot of labelled examples, and if those examples skew, the model inherits the skew. People have tried mixing a few labels with unlabelled text.";
  const source: SourceDocument = {
    id: "s1",
    title: "Source",
    kind: "web",
    text: SOURCE_TEXT,
  };
  const result = matchSources(submission, [source]);
  assert.equal(result.sourceCount, 0, "paraphrase must not match");
});

ok("ignores short coincidental overlaps", () => {
  const submission =
    "Machine learning models require substantial amounts of care. That is all I want to say about it here.";
  const source: SourceDocument = {
    id: "s1",
    title: "Source",
    kind: "web",
    text: SOURCE_TEXT,
  };
  const result = matchSources(submission, [source]);
  assert.equal(result.sourceCount, 0, "an 6-word overlap is not evidence");
});

ok("coverage never exceeds 1", () => {
  const submission = SOURCE_TEXT;
  const source: SourceDocument = { id: "s1", title: "S", kind: "web", text: SOURCE_TEXT };
  const result = matchSources(submission, [source]);
  assert.ok(result.coverage <= 1);
  assert.ok(result.coverage > 0.5);
});

ok("skips sources too short to match", () => {
  const result = matchSources("anything at all here", [
    { id: "s", title: "t", kind: "web", text: "tiny" },
  ]);
  assert.equal(result.sourceCount, 0);
});

ok("picks searchable excerpts spread across the document", () => {
  const long = Array.from(
    { length: 20 },
    (_, i) =>
      `Paragraph ${i} discusses a distinctive topic such as photosynthesis regulation in alpine moss species number ${i}.`,
  ).join(" ");
  const excerpts = searchExcerpts(long, 5);
  assert.equal(excerpts.length, 5);
  assert.equal(new Set(excerpts).size, 5);
});

// ------------------------------------------------------------------ citations
ok("counts cited and uncited claims", () => {
  const text =
    "Studies show that retrieval practice improves retention (Roediger & Karpicke, 2006). Research indicates a 40 percent gain in recall. The evidence is mixed.";
  const audit = auditCitations(text);
  assert.equal(audit.totalClaims, 3);
  assert.equal(audit.cited, 1);
  assert.equal(audit.uncited.length, 2);
  assert.ok(audit.score < 100);
});

ok("numeric bracket citations count as cited", () => {
  const audit = auditCitations("The results improved by 12 percent [3].");
  assert.equal(audit.cited, 1);
  assert.equal(audit.uncited.length, 0);
});

ok("a text with no claims scores 100", () => {
  const audit = auditCitations("The kettle is on the table.");
  assert.equal(audit.score, 100);
  assert.equal(audit.uncited.length, 0);
});

console.log(`\n${checks} checks passed.`);

const twice = matchSources(SOURCE_TEXT, [
 {id:"a",title:"A",kind:"upload",text:SOURCE_TEXT},
 {id:"b",title:"B",kind:"upload",text:SOURCE_TEXT},
]);
assert.equal(twice.matchedWords, tokens(SOURCE_TEXT).length, "duplicate sources must not double-count words");
assert.equal(twice.coverage, 1);
assert.equal(wordCount("हिन्दी शिक्षा कंप्यूटर"), 3, "combining marks belong to their word");
console.log("PASS unique overlap and Indic token boundaries");
