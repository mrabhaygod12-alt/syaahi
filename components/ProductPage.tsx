import { breadcrumbSchema, faqSchema, jsonLd } from "@/lib/seo";
import { Faq, PageHero } from "./site";
import type { ReactNode } from "react";
export default function ProductPage({
  title,
  kicker,
  lede,
  path,
  children,
  faqs = [],
  schema,
}: {
  title: string;
  kicker: string;
  lede: string;
  path: string;
  children: ReactNode;
  faqs?: Array<{ q: string; a: string }>;
  schema?: unknown;
}) {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: title, path },
  ];
  return (
    <div className="product-public-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema(crumbs)) }}
      />
      {schema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
        />
      ) : null}
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(faqs)) }}
        />
      )}
      <nav className="wrap product-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span aria-hidden="true">/</span>
        <span>{title}</span>
      </nav>
      <PageHero title={title} kicker={kicker} lede={lede} />
      <div className="wrap product-public-content">{children}</div>
      {faqs.length > 0 && <Faq items={faqs} />}
    </div>
  );
}
