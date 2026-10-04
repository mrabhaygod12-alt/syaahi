import WriterStudio from "@/components/WriterStudio";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Writer Studio",
  description:
    "Write articles and guides with headings and images. Keep private drafts and submit for editorial review in Syaahi Writer Studio.",
  path: "/write",
  noindex: true,
});

export default function WritePage() {
  return (
    <div className="wrap feature-section">
      <h1>Writer Studio</h1>
      <p>
        Write with headings, photos and readable formatting. Save privately,
        then submit for editorial review.
      </p>
      <WriterStudio />
    </div>
  );
}
