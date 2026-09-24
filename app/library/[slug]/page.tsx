import { notFound } from "next/navigation";
import { pageMeta, breadcrumbSchema, faqSchema, jsonLd } from "@/lib/seo";
import { PageHero, Faq, CtaBand } from "@/components/site";
import { readFile } from "node:fs/promises";
import NotePage from "@/components/NotePage";
import { DEFAULT_STYLE } from "@/lib/handwriting/options";
import { join } from "node:path";

async function lib() {
  const raw = await readFile(
    join(process.cwd(), "data", "library.json"),
    "utf8",
  );
  return JSON.parse(raw).packs as any[];
}

export async function generateStaticParams() {
  try {
    const packs = await lib();
    return packs.map((p: any) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  try {
    const packs = await lib();
    const p = packs.find((x) => x.slug === resolvedParams.slug);
    if (!p) return {};
    return pageMeta({
      title: `${p.title} handwritten notes`,
      description: `Free preview + full handwritten PDF for ${p.title} (${p.category}). ${p.pages} pages, one credit per generated section. Definition, key points, example and mnemonic included.`,
      path: `/library/${p.slug}`,
    });
  } catch {
    return {};
  }
}

export default async function PackPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  let packs: any[] = [];
  try {
    packs = await lib();
  } catch {
    notFound();
  }
  const p = packs.find((x) => x.slug === resolvedParams.slug);
  if (!p) notFound();
  const related = packs
    .filter((x) => x.slug !== p.slug && x.category === p.category)
    .concat(packs.filter((x) => x.slug !== p.slug && x.category !== p.category))
    .slice(0, 4);
  const faqs = [
    {
      q: `How many pages is the ${p.title} pack?`,
      a: `${p.pages} handwritten pages, one topic per page. This is a public preview. Create a private lesson for your own study plan.`,
    },
    {
      q: `Is the ${p.title} content exam-ready?`,
      a: `It is an AI-generated revision draft. Verify formulas, dates and definitions against your textbook before the exam.`,
    },
    {
      q: "Can I regenerate in a different handwriting?",
      a: "Yes — open Generate, type the same topics, pick a supported font, paper, and template.",
    },
  ];
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${p.title} handwritten notes`,
    about: p.title,
    genre: p.category,
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Library", path: "/library" },
              { name: p.title, path: `/library/${p.slug}` },
            ]),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(faqs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(article) }}
      />
      <PageHero
        kicker={`${p.category} · ${p.pages} pages`}
        title={`${p.title} — handwritten notes`}
        lede={`Free page-1 preview below. Create a private lesson to build your own notes.`}
      />
      <div className="wrap" style={{ paddingTop: 24 }}>
        <h2>What&apos;s inside</h2>
        <ul>
          {p.topics.map((t: string) => (
            <li key={t}>Page — {t}</li>
          ))}
        </ul>
        <h2 style={{ marginTop: 24 }}>Free preview · page 1</h2>
        <div style={{ marginTop: 8 }}>
          <NotePage
            markdown={p.preview}
            style={DEFAULT_STYLE}
            seedKey={`lib-${p.slug}`}
            footer="preview · syaahi · full PDF unlocks after purchase"
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <a
            className="btn dark"
            href={`/dashboard?topic=${encodeURIComponent(p.title)}`}
          >
            Unlock full pack — {p.pages} credits
          </a>
          <a className="btn light" href="/dashboard">
            Regenerate in my style
          </a>
        </div>
        <h2 style={{ marginTop: 32 }}>Related packs</h2>
        <div className="grid grid-4">
          {related.map((r) => (
            <a
              key={r.slug}
              href={`/library/${r.slug}`}
              className="card"
              style={{ textDecoration: "none" }}
            >
              <div className="small">
                {r.category} · {r.pages} pages
              </div>
              <b>{r.title}</b>
            </a>
          ))}
        </div>
      </div>
      <Faq items={faqs} />
      <CtaBand />
    </>
  );
}
