import { pageMeta, faqSchema, jsonLd } from "@/lib/seo";
import { PageHero, Faq, CtaBand } from "@/components/site";
import LibraryClient from "./LibraryClient";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const metadata = pageMeta({
  title: "Library — free handwritten notes previews",
  description:
    "Browse free handwritten notes previews: Physics, Biology, History, CS and interview packs. Browse public sample material, then create your own private lessons.",
  path: "/library",
});

const FAQS = [
  {
    q: "Where are the free previews?",
    a: "This library contains curated public examples when the operator adds them. Your private lessons are not automatically published.",
  },
  {
    q: "Can I request a missing topic?",
    a: "Yes. Create a private lesson on the dashboard. It stays in your account.",
  },
];

async function getPacks() {
  try {
    const raw = await readFile(
      join(process.cwd(), "data", "library.json"),
      "utf8",
    );
    return JSON.parse(raw).packs ?? [];
  } catch {
    return [];
  }
}

export default async function Library() {
  const packs = await getPacks();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(FAQS)) }}
      />
      <PageHero
        kicker="Library"
        title="Explore free notes"
        lede="Individual handwritten packs on high-demand topics. Open any pack for its free preview, topics list and related packs."
      />
      <div className="wrap" style={{ paddingBottom: 8 }}>
        <LibraryClient initialPacks={packs} />
      </div>
      <Faq items={FAQS} />
      <CtaBand />
    </>
  );
}
