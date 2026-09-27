import AboutStory from "@/components/AboutStory";
import { jsonLd, pageMeta, SITE } from "@/lib/seo";
export const metadata = pageMeta({
  title: "About Chandan, Manish and Syaahi",
  path: "/about",
  description:
    "Meet creator Chandan Pandey and Manish Kumar Singh, DevOps Engineer & Researcher, and explore the people behind Syaahi.",
});
export default function About() {
  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Syaahi and its creators",
    url: `${SITE.url}/about`,
    mainEntity: [
      {
        "@type": "Person",
        "@id": `${SITE.url}/about#chandan-pandey`,
        name: "Chandan Pandey",
        jobTitle: "Creator of Syaahi; Web Application Developer",
        image: `${SITE.url}/team/chandan-pandey.jpeg`,
        description:
          "Pursuing an MSc in Digital Forensics and Cyber Security at Lovely Professional University, with four years of web application development and security assessment experience.",
        sameAs: [
          "https://chandanpandeyprot.netlify.app/",
          "https://www.linkedin.com/in/chandan-pandey-5b255a3aa",
          "https://github.com/thecnical",
          "https://x.com/CPandey8752",
        ],
        worksFor: { "@type": "Organization", name: SITE.name, url: SITE.url },
      },
      {
        "@type": "Person",
        "@id": `${SITE.url}/about#manish-kumar-singh`,
        name: "Manish Kumar Singh",
        jobTitle: "DevOps Engineer and Researcher",
        image: `${SITE.url}/team/manish-kumar-singh.png`,
        description:
          "Works with Syaahi on deployment, infrastructure and operational reliability.",
        worksFor: { "@type": "Organization", name: SITE.name, url: SITE.url },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(aboutSchema) }}
      />
      <AboutStory />
    </>
  );
}
