import LandingPage, { LANDING_FAQS } from "@/components/LandingPage";
import { pageMeta, jsonLd, faqSchema, SITE } from "@/lib/seo";
export const metadata = pageMeta({
  title: "AI Notes, Presentations & Blog Writing",
  path: "/",
  description:
    "Learn, teach and write with Syaahi. Create source-aware notes and editable presentations, or publish reviewed articles with headings, images and your own profile.",
});

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "@id": `${SITE.url}/#application`,
            name: SITE.name,
            alternateName: "Syaahii",
            url: `${SITE.url}/`,
            operatingSystem: "Web browser",
            applicationCategory: "EducationalApplication",
            description: SITE.description,
            publisher: { "@id": `${SITE.url}/#organization` },
            audience: ["Students", "Teachers", "Professionals", "Writers"].map(
              (audienceType) => ({ "@type": "Audience", audienceType }),
            ),
            featureList: [
              "Source-aware notes",
              "Editable presentations",
              "Quizzes and flashcards",
              "Rich article editing",
              "Private drafts and revisions",
              "Reviewed public articles",
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(LANDING_FAQS)) }}
      />
      <LandingPage />
    </>
  );
}
