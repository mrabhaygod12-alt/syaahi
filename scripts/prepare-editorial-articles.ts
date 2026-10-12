import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  normalizeDocument,
  documentText,
  type RichNode,
} from "../lib/writing/document";
const folder = join(process.cwd(), "docs/articles/2026-10-12");
const articles = [
  {
    file: "openai-gpt-6-1-sol",
    summary:
      "A source-checked guide to GPT-6.1 Sol, with a university project workflow, realistic evaluation criteria and practical budget checks.",
    tags: ["AI", "OpenAI", "Computer Science", "University"],
    label: "OPENAI · ENGINEERING JUDGMENT",
    headline: ["Make the model", "earn its score."],
    steps: ["Define the task", "Inspect the evidence", "Test the behavior"],
    caption:
      "An original Syaahi diagram: requirements, evidence and tests guide a model evaluation. This is a workflow illustration, not a benchmark chart.",
  },
  {
    file: "claude-5-5-model-routing",
    summary:
      "Understand the recent Claude 5.5 releases and design a measurable routing experiment for research, coding and source-grounded university projects.",
    tags: ["AI", "Claude", "Research", "Computer Science"],
    label: "CLAUDE · WORKFLOW DESIGN",
    headline: ["Different work.", "Different judgment."],
    steps: ["Extract evidence", "Compare findings", "Review the synthesis"],
    caption:
      "An original Syaahi diagram showing three bounded jobs in a research workflow. Model selection should be verified on your own tasks.",
  },
  {
    file: "gemini-3-8-university-projects",
    summary:
      "Current Gemini 3.8 Flash facts and migration notes, plus a practical guide to evidence maps, source-aware explanations and reliable university prototypes.",
    tags: ["AI", "Gemini", "University", "Research"],
    label: "GEMINI · SOURCE-AWARE LEARNING",
    headline: ["More context.", "Clearer evidence."],
    steps: ["Collect sources", "Map each claim", "Verify the explanation"],
    caption:
      "An original Syaahi illustration: sources connect to claims and a checked explanation. Large context capacity does not replace evidence review.",
  },
  {
    file: "github-ai-agent-security",
    summary:
      "A practical security checklist for students adopting GitHub AI-agent projects: inspect setup scripts, restrict permissions, protect credentials and verify external actions.",
    tags: ["Cybersecurity", "GitHub", "AI", "Computer Science"],
    label: "GITHUB · RESPONSIBLE ENGINEERING",
    headline: ["Before you run it,", "know its boundaries."],
    steps: ["Inspect the setup", "Limit permissions", "Verify every action"],
    caption:
      "An original Syaahi illustration showing setup inspection, permission boundaries and action verification for an AI-agent project.",
  },
];
function inline(value: string): RichNode[] {
  const result: RichNode[] = [];
  let at = 0;
  for (const match of value.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
    if (match.index! > at)
      result.push({ type: "text", text: value.slice(at, match.index) });
    result.push({
      type: "text",
      text: match[1],
      marks: [{ type: "link", attrs: { href: match[2] } }],
    });
    at = match.index! + match[0].length;
  }
  if (at < value.length) result.push({ type: "text", text: value.slice(at) });
  return result;
}
async function main() {
  const manifest = [];
  for (const [index, item] of articles.entries()) {
    const md = readFileSync(join(folder, item.file + ".md"), "utf8");
    const chunks = md.trim().split(/\r?\n\s*\r?\n/);
    const title = chunks.shift()!.replace(/^# /, "");
    chunks.shift();
    const document = normalizeDocument({
      type: "doc",
      attrs: {
        theme: "journal",
        articleFont: "Georgia",
        paper: "white",
        pageMargin: "standard",
      },
      content: chunks.map((value) =>
        value.startsWith("## ")
          ? {
              type: "heading",
              attrs: { level: 2 },
              content: inline(value.slice(3)),
            }
          : {
              type: "paragraph",
              content: inline(value.replace(/\r?\n/g, " ")),
            },
      ),
    });
    writeFileSync(
      join(folder, item.file + ".draft.json"),
      JSON.stringify(
        {
          title,
          summary: item.summary,
          authorByline: "Chandan Pandey",
          tags: item.tags,
          document,
        },
        null,
        2,
      ),
    );
    const accent = ["#c6da99", "#ebbe98", "#b4d5cd", "#d5c2e9"][index];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="810" viewBox="0 0 1440 810"><rect width="1440" height="810" fill="#172b23"/><path d="M1030 0v810M1130 0v810M1230 0v810M1330 0v810M0 710h1440" stroke="#344b3e"/><circle cx="1250" cy="200" r="110" fill="none" stroke="${accent}" stroke-width="2"/><circle cx="1250" cy="200" r="68" fill="none" stroke="${accent}" stroke-width="2"/><path d="m1188 220 45 38 83-110" stroke="${accent}" stroke-width="8" fill="none"/><text x="80" y="100" fill="${accent}" font-family="Verdana" font-size="20" letter-spacing="3">${item.label}</text><text x="80" y="270" fill="#f4f1e7" font-family="Georgia" font-size="86">${item.headline[0]}</text><text x="80" y="370" fill="${accent}" font-family="Georgia" font-size="86">${item.headline[1]}</text>${item.steps.map((step, i) => `<rect x="${80 + i * 435}" y="505" width="395" height="132" rx="12" fill="#243c30" stroke="#516650"/><text x="${110 + i * 435}" y="550" fill="${accent}" font-family="Verdana" font-size="17">0${i + 1}</text><text x="${110 + i * 435}" y="602" fill="#f4f1e7" font-family="Verdana" font-size="24">${step}</text>`).join("")}<text x="80" y="755" fill="#c0c9b7" font-family="Verdana" font-size="18">SYAAHI JOURNAL · CHANDAN PANDEY · ORIGINAL WORKFLOW ILLUSTRATION</text></svg>`;
    writeFileSync(join(folder, item.file + ".svg"), svg);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(join(folder, item.file + ".png"));
    manifest.push({
      file: item.file,
      title,
      byline: "Chandan Pandey",
      words: documentText(document).split(/\s+/).filter(Boolean).length,
      caption: item.caption,
      image: item.file + ".png",
      draft: item.file + ".draft.json",
      status: "prepared",
    });
  }
  writeFileSync(
    join(folder, "manifest.json"),
    JSON.stringify(
      { sourcesChecked: "2026-10-12", articles: manifest },
      null,
      2,
    ),
  );
  console.log(
    manifest.map((a) => ({ title: a.title, words: a.words, image: a.image })),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
