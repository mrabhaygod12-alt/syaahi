import type { Metadata } from "next";

// Single source of truth for SEO + GEO (Generative Engine Optimization).
// Every page uses pageMeta() so titles, descriptions, canonicals and OG tags
// stay consistent for Google AND for AI answer engines (ChatGPT, Perplexity…).
export const SITE = {
  name: "Syaahi",
  tagline: "AI Handwritten Exam Notes Generator",
  url: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  ),
  description:
    "Turn any topic into beautiful handwritten exam notes. Generate custom handwritten PDFs for school, college and interviews — free previews, pay-as-you-go credits, instant download.",
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
    title: `${title} | ${SITE.name}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title: `${title} | ${SITE.name}`,
      description,
      url,
      locale: SITE.locale,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE.name}`,
      description,
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
    name: SITE.name,
    url: SITE.url,
    slogan: SITE.tagline,
    description: SITE.description,
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    inLanguage: "en-IN",
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
