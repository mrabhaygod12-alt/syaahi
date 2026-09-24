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
