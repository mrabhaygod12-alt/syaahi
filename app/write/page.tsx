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
  return <WriterStudio />;
}
