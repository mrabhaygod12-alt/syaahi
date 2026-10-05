import type { Metadata } from "next";

const fallbackSiteUrl =
  process.env.NODE_ENV === "production"
    ? "https://www.syaahii.in"
    : "http://localhost:3000";

function resolveSiteUrl(value: string | undefined): string {
  const configured = value?.trim();
  if (!configured) return fallbackSiteUrl;

  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return fallbackSiteUrl;
    return parsed.origin;
  } catch {
    // A blank or malformed dashboard variable must not make Next.js fail while
    // it imports root metadata to collect static page data.
    return fallbackSiteUrl;
  }
}

// Single source of truth for SEO + GEO (Generative Engine Optimization).
// Every page uses pageMeta() so titles, descriptions, canonicals and OG tags
// stay consistent for Google AND for AI answer engines (ChatGPT, Perplexity…).
export const SITE = {
  name: "Syaahi",
  tagline: "Learn, create and publish",
  url: resolveSiteUrl(process.env.NEXT_PUBLIC_APP_URL),
  description:
    "Syaahi brings learning and writing together for students, teachers, professionals and writers. Create notes and presentations, or publish reviewed articles.",
  locale: "en_IN",
};

export function pageMeta(opts: {
  article?: { author: string; publishedAt: string };
  title: string;
  description?: string;
  path?: string;
  noindex?: boolean;
}): Metadata {
  const {
    title,
    description = SITE.description,
    path = "/",
    noindex = false,
  } = opts;
  const url = `${SITE.url}${path}`;
  return {
    title: { absolute: `${title} | ${SITE.name}` },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: opts.article ? "article" : "website",
      ...(opts.article
        ? {
            authors: [opts.article.author],
            publishedTime: opts.article.publishedAt,
          }
        : {}),
      siteName: SITE.name,
      title: `${title} | ${SITE.name}`,
      description,
      url,
      locale: SITE.locale,
      images: [
        {
          url: `${SITE.url}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: "Syaahi: learning, presentations and reviewed writing",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE.name}`,
      description,
      images: [`${SITE.url}/opengraph-image`],
    },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

export function jsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export function orgSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    alternateName: ["Syaahii", "Syaahi at syaahii.in"],
    url: SITE.url,
    slogan: SITE.tagline,
    description: SITE.description,
    logo: `${SITE.url}/icon-512.png`,
    founder: [
      { "@type": "Person", name: "Chandan Pandey", url: `${SITE.url}/about` },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${SITE.url}/support`,
    },
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    name: SITE.name,
    alternateName: ["Syaahii", "syaahii.in"],
    url: SITE.url,
    description: SITE.description,
    inLanguage: "en-IN",
    publisher: { "@id": `${SITE.url}/#organization` },
  };
}

export function faqSchema(faqs: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE.url}${it.path}`,
    })),
  };
}
export function presentationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE.url}/ai-presentations#software`,
    name: "Syaahi Presentation Studio",
    url: `${SITE.url}/ai-presentations`,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web browser",
    inLanguage: ["en", "hi", "de", "fr", "es"],
    description:
      "Import your private lesson or document sources, approve an outline, edit slides, and export presentations.",
    featureList: [
      "Source imports",
      "Public article research",
      "Saved narrative plan",
      "Six fixed visual archetypes",
      "Outline approval",
      "Editable slide objects",
      "Slide preview",
      "PowerPoint export",
      "PDF export",
      "Speaker notes",
      "Revocable sharing",
    ],
    publisher: { "@id": `${SITE.url}/#organization` },
  };
}
export function writingSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE.url}/writing/features#software`,
    name: "Syaahi Write & Publish",
    url: `${SITE.url}/writing/features`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web browser",
    description:
      "Rich article editing, private drafts and revisions, distinct public writer profiles and editorially reviewed publication.",
    featureList: [
      "Rich article editor",
      "Private drafts and revisions",
      "Separate writer profiles",
      "Editorial submission",
      "Following and public responses",
      "Private reading notes",
      "Story statistics",
      "Canonical links",
    ],
    publisher: { "@id": `${SITE.url}/#organization` },
  };
}
