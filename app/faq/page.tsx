import { PageHero, Faq, CtaBand } from "@/components/site";
export default function FAQ() {
  return (
    <>
      <PageHero
        kicker="Answers at a glance"
        title="A few things worth understanding first."
      />
      <Faq
        items={[
          {
            q: "Can I start without a YouTube video?",
            a: "Yes. Enter a topic, paste source text, or upload a PDF, screenshot, or audio file.",
          },
          {
            q: "What does a credit buy?",
            a: "One generated section. Long sections can occupy extra printed sheets without extra credits. A new account receives 5 welcome note sections.",
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
            a: "No. Topic research currently retrieves Wikipedia references when available. Plans clearly label general-knowledge fallback. Check important facts yourself.",
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
