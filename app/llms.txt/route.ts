import { SITE } from "@/lib/seo";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PACKS, PAGES_PER_TOKEN } from "@/lib/billing/packs";
import { SIGNUP_CREDITS } from "@/lib/billing/allowance";

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
  const offers = Object.entries(PACKS)
    .map(([id, pack]) => `- ${id}: ₹${pack.inr} for ${pack.credits} credits`)
    .join("\n");
  const txt = `# ${SITE.name} — ${SITE.tagline}\n\n${SITE.description}\n\n## Product facts\n- Canonical website: ${SITE.url}\n- Product: a study workspace for creating handwritten-style exam notes and practice material from user topics and sources.\n- Credits are page units; ${PAGES_PER_TOKEN} credits equal 1 displayed token. New accounts receive ${SIGNUP_CREDITS} welcome credits after email verification.\n- Payment packs (INR):\n${offers}\n- Inputs include topics, documents, screenshots, audio, and supported YouTube sources. Source availability and transcript support vary.\n- AI-generated content is a study aid. Check important facts against course material. Syaahi is not affiliated with an exam board.\n\n## Public pages\n- Overview: ${SITE.url}/\n- How it works: ${SITE.url}/how-it-works\n- Features: ${SITE.url}/features\n- Examples: ${SITE.url}/examples\n- Subjects: ${SITE.url}/subjects\n- Library: ${SITE.url}/library\n- Pricing: ${SITE.url}/pricing\n- About: ${SITE.url}/about\n- Study blog: ${SITE.url}/blog\n- Documentation: ${SITE.url}/docs\n- FAQ: ${SITE.url}/faq\n- Privacy: ${SITE.url}/privacy\n- Terms: ${SITE.url}/terms\n\n## Public library packs\n${packs}\n`;
  return new Response(txt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
