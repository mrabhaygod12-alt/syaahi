import { pageMeta } from "@/lib/seo";
import { COURSE_PACKS } from "@/lib/course-packs";

export const metadata = pageMeta({
  title: "University course pack starters",
  description: "Use Syaahi course-pack starters to plan private notes from your current university syllabus, then verify every topic with your institution.",
  path: "/course-packs",
});

export default function CoursePacksPage() {
  return <main className="wrap feature-section"><p className="eyebrow">COURSE-PACK STARTERS</p><h1>Start from a course outline you can verify.</h1><p className="small" style={{ maxWidth: 760 }}>These are private study-planning starters, not official university syllabi. Select one, then compare the topics with your current course document before creating notes.</p><div className="steps-grid">{COURSE_PACKS.map((pack) => <article className="interactive-panel" key={pack.slug}><p className="eyebrow">{pack.term}</p><h2>{pack.title}</h2><p className="small">{pack.institution} · {pack.programme}</p><p>{pack.description}</p><ul className="small">{pack.topics.slice(0, 4).map((topic) => <li key={topic}>{topic}</li>)}</ul><a className="btn dark" href={`/dashboard?coursePack=${encodeURIComponent(pack.slug)}`}>Use this starter →</a></article>)}</div></main>;
}
