import { pageMeta } from "@/lib/seo";
import { PageHero } from "@/components/site";
import { RESOURCE_TEMPLATES } from "@/lib/growth/resources";
import ResourceLink from "@/components/growth/ResourceLink";
export const metadata = pageMeta({
  title: "Free University Revision Planners & Recall Worksheets",
  description:
    "Download original printable revision planners and CS active-recall worksheets for UG/PG study. No account required.",
  path: "/resources",
});
export default function Resources() {
  return (
    <>
      <PageHero
        kicker="MAKE REVISION PRACTICAL"
        title="A small plan. A useful next step."
        lede="Original printable resources for university study. Free to download, without an email form."
      />
      <section className="wrap feature-section grid grid-2">
        {Object.entries(RESOURCE_TEMPLATES).map(([id, r]) => (
          <article className="card" key={id}>
            <h2>{r.title}</h2>
            <p>
              {id === "planner"
                ? "Pick priorities, plan a short study session and schedule your next review."
                : "Define, trace, test assumptions and check mistakes against your course source."}
            </p>
            <ResourceLink id={id} />
          </article>
        ))}
      </section>
    </>
  );
}
