import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Study Subjects & Revision Notes",
  description:
    "Explore physics, maths, biology, chemistry, computer science and more. Bring your syllabus to create focused Syaahi notes and practice material.",
  path: "/subjects",
});
import { PageHero, CtaBand } from "@/components/site";
import SubjectExplorer from "@/components/SubjectExplorer";
export default function Subjects() {
  return (
    <>
      <PageHero
        kicker="Follow your curiosity"
        title="A starting point for every subject."
        lede="Explore familiar subjects or create a lesson on something entirely your own. Bring your syllabus for a closer fit."
      />
      <SubjectExplorer />
      <CtaBand />
    </>
  );
}
