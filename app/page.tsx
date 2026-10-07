import LandingPage, { LANDING_FAQS } from "@/components/LandingPage";
import { pageMeta, jsonLd, faqSchema, SITE } from "@/lib/seo";
export const metadata = pageMeta({
  title: "UG & PG Study Notes, AI Presentations & Writing",
  path: "/",
  description:
    "Turn university topics, PDFs and lectures into handwritten-style revision notes. Try UG/PG CS, DBMS and operating systems previews, build presentations, or publish reviewed articles.",
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
