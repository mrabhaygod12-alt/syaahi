import {
  MONTHLY_PLANS,
  STUDENT_MONTHLY_TIERS,
} from "@/lib/billing/subscription-plans";
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
  const offers = STUDENT_MONTHLY_TIERS.map(
    (id) =>
      `- ${id}: ₹${MONTHLY_PLANS[id].inr}/month INR for ${MONTHLY_PLANS[id].credits} monthly credits`,
  ).join("\n");
  const txt = `# ${SITE.name}: ${SITE.tagline}

${SITE.description}

## Product facts
- Canonical website: [${SITE.url}](${SITE.url})
- Who it serves: students, teachers, professionals and writers. Syaahi brings learning and writing together in one account.
- Two workspaces: Learn & create for notes, presentations and practice; Write & publish for private articles, revision history and reviewed publication. The starting-dashboard preference does not grant security permissions.
- Writing: rich-text headings, lists, links, uploaded images with alt text, preview, autosave and draft revisions. Writers may use their own language. Approved articles have public URLs and creator attribution; acceptance and readership are not guaranteed.
- Reading and publishing: durable writer follows, public plain-text responses with author moderation, account-private highlights and reading notes, saved reading positions, qualified signed-in reader counts and original-publication canonical links. Following is not newsletter subscription. There is no author payout programme, subscriber paywall or publication team workspace.
- Community: public articles appear after editorial review, with bookmarking, upvotes and content reports. Private drafts, editorial notes and account information are not public content.
- Learning: handwritten-style notes, source labels, lesson chat, quizzes, flashcards, saved progress and printable PDFs.
- Inputs: topics, documents, screenshots, audio and supported YouTube sources. Source availability and transcript support vary.
- Generation languages: English, Hindi, Hinglish, German, French and Spanish. This does not mean that every interface page is translated.
- New accounts receive ${SIGNUP_CREDITS} welcome credits after email verification. Each generated note section uses one credit. Additional PDF continuation sheets are free.
- Student plans: Free plus one-time Try ₹9 (3 credits), Starter ₹39 (15) and Popular ₹79 (36), and recurring Max ₹399 per month (360). Writer plans: exactly Free and Max ₹399 per month. Only Max is offered as a new subscription. One wallet/subscription is shared across both workspaces. Unused wallet credits are retained. The old ₹179 Pro offer is retired for new purchases; existing subscription terms remain. Team is a separate contact-sales inquiry. International payment availability depends on the merchant account.
- Monthly plans (INR):
${offers}
- Presentations: free saved narrative planning and approval before five-credit generation; one credit for a saved slide regeneration, returned on failure. Public article link extraction and owned lesson/PDF/text imports, six typed visual layouts, nine themes, a separate editorial pass, preview, editable objects, native PPTX, slide PDF/PNG and speaker-note handouts. Private source imports and revocable seven-day share links. Free and one-time credit packs support six slides; Max supports fifteen. Historical subscription slide limits remain as purchased. Public extraction respects source access; paywalls and blocked sites are not bypassed.
- Creators: Chandan Pandey and Manish Kumar Singh. Their backgrounds are described on the About page.
- Review generated output and public claims against original sources. Syaahi is not affiliated with an exam board, employer or professional accreditation body.

## Public pages
- [Overview](${SITE.url}/)
- [Writing and publishing](${SITE.url}/writing)
- [All writer features](${SITE.url}/writing/features)
- [Writer pricing](${SITE.url}/writing/pricing)
- [Medium capability comparison](${SITE.url}/writing/medium-comparison)
- [Official Syaahi product guide](${SITE.url}/syaahi)
- [Public product facts](${SITE.url}/product-facts.json)
- [Reviewed story RSS feed](${SITE.url}/feed.xml)
- [Community articles](${SITE.url}/community)
- [How it works](${SITE.url}/how-it-works)
- [Features](${SITE.url}/features)
- [Examples](${SITE.url}/examples)
- [Subjects](${SITE.url}/subjects)
- [Library](${SITE.url}/library)
- [Pricing](${SITE.url}/pricing)
- [Presentations](${SITE.url}/ai-presentations)
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
