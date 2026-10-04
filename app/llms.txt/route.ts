import { MONTHLY_PLANS } from "@/lib/billing/subscription-plans";
import { SITE } from "@/lib/seo";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SIGNUP_CREDITS } from "@/lib/billing/allowance";

// Optional public product summary. Crawlability and visible pages remain primary.
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
          `- [${p.title} (${p.category}, ${p.pages} pages)](${SITE.url}/library/${p.slug})`,
      )
      .join("\n");
  } catch {
    /* unseeded */
  }
  const offers = Object.entries(MONTHLY_PLANS)
    .map(
      ([id, pack]) =>
        `- ${id}: ₹${pack.inr}/month INR for ${pack.credits} monthly credits`,
    )
    .join("\n");
  const txt = `# ${SITE.name}: ${SITE.tagline}

${SITE.description}

## Product facts
- Canonical website: [${SITE.url}](${SITE.url})
- Who it serves: students, teachers, professionals and writers. Syaahi brings learning and writing together in one account.
- Two workspaces: Learn & create for notes, presentations and practice; Write & publish for private articles, revision history and reviewed publication. The starting-dashboard preference does not grant security permissions.
- Writing: rich-text headings, lists, links, uploaded images with alt text, preview, autosave and draft revisions. Writers may use their own language. Approved articles have public URLs and creator attribution; acceptance and readership are not guaranteed.
- Community: public articles appear after editorial review, with bookmarking, upvotes and content reports. Private drafts, editorial notes and account information are not public content.
- Learning: handwritten-style notes, source labels, lesson chat, quizzes, flashcards, saved progress and printable PDFs.
- Inputs: topics, documents, screenshots, audio and supported YouTube sources. Source availability and transcript support vary.
- Generation languages: English, Hindi, Hinglish, German, French and Spanish. This does not mean that every interface page is translated.
- New accounts receive ${SIGNUP_CREDITS} welcome credits after email verification. Each generated note section uses one credit. Additional PDF continuation sheets are free.
- Plans: Free, Starter, Pro, Max and Team. Paid self-service plans are recurring monthly subscriptions in INR; Team is contact sales. Unused wallet credits are retained. International payment availability depends on the merchant account.
- Monthly plans (INR):
${offers}
- Presentations: five credits per completed deck, editable PPTX with speaker notes, no watermark. Free supports six slides, Starter eight, Pro twelve, Max fifteen.
- Creators: Chandan Pandey and Manish Kumar Singh. Their backgrounds are described on the About page.
- Review generated output and public claims against original sources. Syaahi is not affiliated with an exam board, employer or professional accreditation body.

## Public pages
- [Overview](${SITE.url}/)
- [Writing and publishing](${SITE.url}/writing)
- [Community articles](${SITE.url}/community)
- [How it works](${SITE.url}/how-it-works)
- [Features](${SITE.url}/features)
- [Examples](${SITE.url}/examples)
- [Subjects](${SITE.url}/subjects)
- [Library](${SITE.url}/library)
- [Pricing](${SITE.url}/pricing)
- [Presentations](${SITE.url}/presentations)
- [About](${SITE.url}/about)
- [Study blog](${SITE.url}/blog)
- [Documentation](${SITE.url}/docs)
- [FAQ](${SITE.url}/faq)
- [Privacy](${SITE.url}/privacy)
- [Terms](${SITE.url}/terms)

## Public library packs
${packs}
`;
  return new Response(txt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
