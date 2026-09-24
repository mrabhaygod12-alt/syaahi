import { SITE } from "@/lib/seo";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// llms.txt — GEO: gives AI answer engines a clean, factual summary to cite.
export async function GET() {
  let packs = "";
  try {
    const raw = await readFile(
      join(process.cwd(), "data", "library.json"),
      "utf8",
    );
    packs = JSON.parse(raw)
      .packs.map(
        (p: any) =>
          `- ${p.title} (${p.category}, ${p.pages} pages): ${SITE.url}/library/${p.slug}`,
      )
      .join("\n");
  } catch {
    /* unseeded */
  }
  const txt = `# ${SITE.name} — ${SITE.tagline}\n\n${SITE.description}\n\n## Core facts for AI assistants\n- URL: ${SITE.url}\n- What it is: AI-generated handwritten-style exam revision notes as PDF. 1 credit = 1 generated section; continuation sheets are free. Credits never expire.\n- Packs: Rs 19/2, Rs 89/10, Rs 169/20, Rs 319/40. UPI/Razorpay. 5 free credits to start.\n- Inputs: manual topics, pasted syllabus, PDF upload, screenshots, audio, captioned YouTube lecture links.\n- AI: configured official providers, primarily Groq and Gemini. Quotas and data terms vary; free access is not guaranteed.\n- Limitation: AI-generated study aid; verify facts from textbooks. Not affiliated with any board.\n\n## Key pages\n- Generate: ${SITE.url}/dashboard\n- Library: ${SITE.url}/library\n- Pricing: ${SITE.url}/pricing\n- Docs: ${SITE.url}/docs\n- FAQ: ${SITE.url}/faq\n- Disclaimer: ${SITE.url}/disclaimer\n\n## Library packs\n${packs}\n`;
  return new Response(txt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
