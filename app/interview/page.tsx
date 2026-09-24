import { PageHero, CtaBand } from "@/components/site";
import InterviewPractice from "@/components/InterviewPractice";
export default function Interview() {
  return (
    <>
      <PageHero
        kicker="Practice with purpose"
        title="A clearer answer starts with better thinking."
        lede="Choose a track, practise against a timer, and get specific AI coaching on your reasoning. Turn difficult questions into study notes."
      />
      <InterviewPractice />
      <CtaBand />
    </>
  );
}
