import { notFound } from "next/navigation";
import { pageMeta, breadcrumbSchema, faqSchema, jsonLd } from "@/lib/seo";
import { PageHero, Faq, CtaBand } from "@/components/site";
import { SUBJECTS } from "@/lib/study/subjects";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function generateStaticParams() {
  return SUBJECTS.map((s) => ({ subject: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const resolvedParams = await params;
  const s = SUBJECTS.find((x) => x.slug === resolvedParams.subject);
  if (!s) return {};
  return pageMeta({
    title: `${s.name} handwritten notes`,
    description: `${s.name} handwritten revision notes: ${s.desc} Free previews, one credit per generated section.`,
    path: `/subjects/${s.slug}`,
  });
}

async function packs() {
  try {
    return JSON.parse(
      await readFile(join(process.cwd(), "data", "library.json"), "utf8"),
    ).packs as any[];
  } catch {
    return [];
  }
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const resolvedParams = await params;
  const s = SUBJECTS.find((x) => x.slug === resolvedParams.subject);
  if (!s) notFound();
  const all = await packs();
  const mine = all.filter((p) =>
    s.match.some((m) => `${p.category} ${p.title}`.toLowerCase().includes(m)),
  );
  const faqs = [
    {
      q: `Are there free ${s.name} previews?`,
      a: `Yes — every pack's first page is free to preview. Create a private lesson to study the topic in your own way.`,
    },
    {
      q: `My ${s.name} topic is missing. What now?`,
      a: `Generate it on the Generate page — type the topic, pick a handwriting style, and download the PDF in about a minute.`,
    },
  ];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Subjects", path: "/subjects" },
              { name: s.name, path: `/subjects/${s.slug}` },
            ]),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(faqs)) }}
      />
      <PageHero
        kicker={s.name}
        title={`${s.name} handwritten notes`}
        lede={s.desc}
      />
      <div className="wrap" style={{ paddingTop: 24, paddingBottom: 8 }}>
        <div className="grid grid-4">
          {mine.map((p) => (
            <a
              key={p.slug}
              href={`/library/${p.slug}`}
              className="card"
              style={{ textDecoration: "none" }}
            >
              <div className="small">
                {p.category} · {p.pages} pages
              </div>
              <b>{p.title}</b>
            </a>
          ))}
          {!mine.length && (
            <div className="card">
              No curated packs in this subject yet. Start a private lesson
              below.
            </div>
          )}
        </div>
        <div style={{ marginTop: 16 }}>
          <a
            className="btn dark"
            href={`/dashboard?topic=${encodeURIComponent(s.name)}`}
          >
            Generate a {s.name} topic
          </a>
        </div>
      </div>
      <Faq items={faqs} />
      <CtaBand />
    </>
  );
}
