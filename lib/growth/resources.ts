import { UNIVERSITY_SAMPLES, type NotePreview } from "./samples";
export const RESOURCE_TEMPLATES = {
  planner: {
    title: "University revision planner",
    body: "## University revision planner\n\n**Department / semester:** __________________\n\n**Exam date:** __________________\n\n### Prioritise three topics\n1. Topic: __________ | Confidence: low / medium / high\n2. Topic: __________ | Confidence: low / medium / high\n3. Topic: __________ | Confidence: low / medium / high\n\n### Plan one realistic session\n- Read the source and explain one concept in your own words.\n- Solve one worked problem or trace one algorithm.\n- Close the notes and answer a recall question.\n\n### Schedule another look\nFirst review: __________\nNext review: __________\nLater review: __________\n\n### What still needs work?\n________________________________________________\n________________________________________________",
  },
  recall: {
    title: "CS active-recall worksheet",
    body: "## CS active-recall worksheet\n\n**Topic and source:** __________________\n\n### Without looking at the notes\n1. Define the main idea in one sentence.\n2. List its assumptions or preconditions.\n3. Trace a small worked example.\n4. Name an edge case or counterexample.\n5. Explain a common misconception.\n\n### Check against your source\nWhat did you miss? __________________\nWhat would you explain differently? __________________\n\n### One exam-style practice question\n________________________________________________\n\n### Explain the answer to someone else\n________________________________________________\n________________________________________________\n\n**Next review date:** __________________",
  },
};
export function previewMarkdown(p: NotePreview) {
  return `## ${p.title}\n\n${p.summary}\n\n${p.points.map((x) => `### ${x.heading}\n${x.text}`).join("\n\n")}\n\n### Recall check\n${p.question}\n\n**Check your answer:** ${p.answer}`;
}
export function resource(key: string, language = "english") {
  if (Object.hasOwn(RESOURCE_TEMPLATES, key))
    return RESOURCE_TEMPLATES[key as keyof typeof RESOURCE_TEMPLATES];
  const sample = UNIVERSITY_SAMPLES.find((s) => s.id === key);
  return sample
    ? {
        title: sample[language === "hindi" ? "hindi" : "english"].title,
        body: previewMarkdown(
          sample[language === "hindi" ? "hindi" : "english"],
        ),
      }
    : null;
}
