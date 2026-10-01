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
  tagline: "Study notes, PDFs and active recall",
  url: resolveSiteUrl(process.env.NEXT_PUBLIC_APP_URL),
  description:
    "Create study notes from your topics and course material. Review sources, export notebook-style PDFs, and practise with quizzes, flashcards and voice mock interviews.",
  locale: "en_IN",
};

export function pageMeta(opts: {
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
      type: "website",
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
          alt: "Syaahi: study notes and active learning",
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
    alternateName: "Syaahii",
    url: SITE.url,
    slogan: SITE.tagline,
    description: SITE.description,
    logo: `${SITE.url}/icon-512.png`,
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
