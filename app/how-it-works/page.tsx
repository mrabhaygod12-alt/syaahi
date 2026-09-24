import { PageHero, Faq, CtaBand } from "@/components/site";
import Walkthrough from "@/components/Walkthrough";
export default function HowItWorks() {
  return (
    <>
      <PageHero
        kicker="A thoughtful workflow"
        title="Less organising. More learning."
        lede="Explore how a question becomes a study plan, a set of notes, and a chance to practise."
      />
      <Walkthrough />
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
