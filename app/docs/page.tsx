import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Syaahi User Guides",
  description:
    "Learn to create your first Syaahi lesson, upload course material, choose handwriting styles, export PDFs and understand study credits.",
  path: "/docs",
});
import { PageHero, CtaBand } from "@/components/site";
import DocsExplorer from "@/components/DocsExplorer";
export default function Docs() {
  return (
    <>
      <PageHero
        kicker="The Syaahi handbook"
        title="Get more from every study session."
        lede="Clear guides to your workspace, source material, practice tools, and exports."
      />
      <DocsExplorer />
      <CtaBand />
    </>
  );
}
