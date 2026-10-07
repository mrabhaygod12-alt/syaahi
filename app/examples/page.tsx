import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Handwritten Study Notes Example",
  description:
    "Read a free, hand-authored binary search note. Preview Syaahi handwriting, diagrams and page layouts before creating your own study notes.",
  path: "/examples",
});
import { PageHero } from "@/components/site";
import { UNIVERSITY_SAMPLES, learningLink } from "@/lib/growth/samples";
import { previewMarkdown } from "@/lib/growth/resources";
import { PreviewPaper } from "@/components/growth/GuestPreview";
import ResourceLink from "@/components/growth/ResourceLink";
import PrintSample from "@/components/growth/PrintSample";
import "@/components/growth/growth.css";
export default async function Examples({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string; language?: string }>;
}) {
  const q = await searchParams,
    language = q.language === "hindi" ? "hindi" : "english",
    sample =
      UNIVERSITY_SAMPLES.find((s) => s.id === q.sample) ||
      UNIVERSITY_SAMPLES[0];
  return (
    <>
      <PageHero
        kicker="A closer look"
        title="University ideas. A clearer first page."
        lede="Original UG/PG CS examples for algorithms, DBMS and operating systems. Read immediately, open the handwriting renderer or download the sample PDF."
      />
      <div className="wrap feature-section" style={{ maxWidth: 850 }}>
        <nav className="growth-suggestions" aria-label="Sample notes">
          {UNIVERSITY_SAMPLES.map((s) => (
            <a
              className="btn light"
              key={s.id}
              href={`/examples?sample=${s.id}&language=${language}`}
            >
              {s.topic}
            </a>
          ))}
          <a
            className="btn light"
            href={`/examples?sample=${sample.id}&language=${language === "hindi" ? "english" : "hindi"}`}
          >
            {language === "hindi" ? "English" : "हिंदी"}
          </a>
        </nav>
        <PreviewPaper preview={sample[language]} />
        <div className="growth-suggestions">
          <ResourceLink id={sample.id} language={language} />
          <a className="btn dark" href={learningLink(sample.topic, language)}>
            Generate this topic →
          </a>
        </div>
        <p className="small">
          Hand-authored sample, not a live AI result.{" "}
          <a href={sample.reading} rel="noreferrer" target="_blank">
            Further reading ↗
          </a>
        </p>
        <PrintSample markdown={previewMarkdown(sample[language])} />
      </div>
    </>
  );
}
