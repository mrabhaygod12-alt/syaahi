import { faqSchema, jsonLd, pageMeta } from "@/lib/seo";
import { PRODUCT_FAQS } from "@/lib/product-copy";
export const metadata = pageMeta({
  title: "Frequently Asked Questions",
  description:
    "Answers about learning, teaching and writing on Syaahi, both workspaces, publication review, notes, presentations, languages, credits and privacy.",
  path: "/faq",
});
import { PageHero, Faq, CtaBand } from "@/components/site";
export default function FAQ() {
  return (
    <>
      <PageHero
        kicker="Answers at a glance"
        title="A few things worth understanding first."
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(faqSchema([...PRODUCT_FAQS])),
        }}
      />
      <Faq items={[...PRODUCT_FAQS]} />
      <Faq
        items={[
          {
            q: "Can I start without a YouTube video?",
            a: "Yes. Enter a topic, paste source text, or upload a PDF, screenshot, or audio file.",
          },
          {
            q: "What does a credit buy?",
            a: "One credit covers a generated note section. Long sections can occupy extra printed sheets without extra credits. A completed presentation uses five credits. New accounts receive 19 welcome credits after email verification.",
          },
          {
            q: "What if generation fails?",
            a: "The server returns reservations for unfinished sections. Completed sections stay saved and consume their credits.",
          },
          {
            q: "Which handwriting fonts work in PDFs?",
            a: "Caveat, Kalam, and Patrick Hand are embedded locally. Hindi text uses Kalam. Choose paper and template options in the Notes toolbar.",
          },
          {
            q: "Is research guaranteed?",
            a: "No. Topic research retrieves Wikipedia references when available; relevant GeeksforGeeks and W3Schools reading searches are separate links, not retrieved evidence. Plans label general-knowledge fallback. Check important facts against the source.",
          },
          {
            q: "How do payments and refunds work?",
            a: "Configured checkout verifies captured payments before adding credits. Monetary refunds require operator review through Support; generation-credit returns are automatic.",
          },
          {
            q: "How do I get help?",
            a: "Open Support for troubleshooting and the operator’s contact, when configured.",
          },
        ]}
      />
      <CtaBand />
    </>
  );
}
