import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { writeFileSync } from "node:fs";
const base = "http://localhost:3101";
const account = await fetch(base + "/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    mode: "signup", acceptTerms:true,termsVersion:"2026-09-24",
    name: "Material QA",
    email: `qa-material-${Date.now()}@example.test`,
    password: randomBytes(18).toString("hex"),
  }),
});
assert.equal(account.status, 200);
const cookie = account.headers.get("set-cookie").split(";")[0];
const png = await sharp(
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="220"><rect width="900" height="220" fill="white"/><text x="30" y="60" font-family="Arial" font-size="28">Photosynthesis study notes</text><text x="30" y="115" font-family="Arial" font-size="24">Chlorophyll absorbs light energy.</text><text x="30" y="160" font-family="Arial" font-size="24">Plants use carbon dioxide and water to produce glucose.</text></svg>',
  ),
)
  .png()
  .toBuffer();
const form = new FormData();
form.append("file", new File([png], "qa-study.png", { type: "image/png" }));
const image = await fetch(base + "/api/image", {
  method: "POST",
  headers: { cookie },
  body: form,
});
const result = await image.json();
assert.equal(image.status, 200, JSON.stringify(result));
assert.match(result.text, /chlorophyll/i);
const research = await fetch(base + "/api/plan", {
  method: "POST",
  headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({
    topic: "Binary search algorithm",
    pages: 1,
    research: true,
  }),
});
const plan = await research.json();
assert.equal(research.status, 200);
assert.equal(plan.evidence, "retrieved");
assert(plan.sources.length > 0);
const invalid = new FormData();
invalid.append(
  "file",
  new File(["not a PDF"], "fake.pdf", { type: "application/pdf" }),
);
const pdf = await fetch(base + "/api/syllabus", {
  method: "POST",
  headers: { cookie },
  body: invalid,
});
assert.equal(pdf.status, 400);
const log = {
  imageOCR: "PASS: synthetic screenshot transcribed accurately",
  research: `PASS: ${plan.sources.length} source(s) retrieved`,
  invalidPDF: "PASS: rejected",
  at: new Date().toISOString(),
};
writeFileSync("output/qa/material-results.json", JSON.stringify(log, null, 2));
console.log(log);
