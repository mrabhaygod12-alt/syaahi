import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "How Syaahi Works",
  description:
    "Follow Syaahi's two workflows: create source-aware notes and presentations, or write rich articles, save private revisions and submit for publication review.",
  path: "/how-it-works",
});
import { PageHero, Faq, CtaBand } from "@/components/site";
import Walkthrough from "@/components/Walkthrough";
export default function HowItWorks() {
  return (
    <>
      <PageHero
        kicker="A thoughtful workflow"
        title="Learn an idea. Create something from it."
        lede="Use the learning workspace for sources, notes and practice. Use the writing workspace for drafts, revisions and reviewed articles. You can switch between them."
      />
      <Walkthrough />
      <section className="wrap home-section">
        <p className="eyebrow">THE WRITING WORKFLOW</p>
        <h2>Draft privately, publish after review.</h2>
        <ol>
          <li>
            Choose Write &amp; publish at signup or login, then open Writer
            Studio.
          </li>
          <li>
            Add a title, headings, lists, links and images you have the right to
            use.
          </li>
          <li>
            Save, preview and revise your draft. Reopen it later with the same
            account.
          </li>
          <li>
            Submit for editorial review, address requested changes and share the
            approved article's public URL.
          </li>
        </ol>
        <a href="/writing">Explore writing for teachers and professionals →</a>
      </section>
      <Faq
        items={[
          {
            q: "Is research always available?",
            a: "Topic research currently searches Wikipedia. Retrieved references appear in the outline. If retrieval fails, the interface labels the result as general knowledge. Supplied material takes priority.",
          },
          {
            q: "What happens when generation fails?",
            a: "Credits for unfinished sections are returned. Completed sections remain available. You can resume missing sections when a provider becomes available.",
          },
          {
            q: "Can the PDF have more pages than I requested?",
            a: "Yes. Your target is the number of planned note sections. Long sections continue onto extra A4 sheets so text is never stretched or clipped.",
          },
        ]}
      />
      <CtaBand />
    </>
  );
}
