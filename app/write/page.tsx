import WriterStudio from "@/components/WriterStudio";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Writer Studio",
  description: "Write a study guide for editorial review in Syaahi Writer Studio.",
  path: "/write",
  noindex: true,
});

export default function WritePage() {
  return <main className="wrap feature-section"><div className="section-heading"><div><span className="eyebrow">SYAAHI LEARNING COMMONS</span><h1>Write a guide students can trust.</h1><p className="small">Draft in Markdown, add a useful summary and tags, then submit your story for review.</p></div></div><WriterStudio /></main>;
}
