import AboutStory from "@/components/AboutStory";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "About Chandan and Syaahi",
  path: "/about",
  description:
    "Meet Chandan Pandey, the creator of Syaahi, and explore the principles behind a visual, evidence-aware study workspace.",
});
export default function About() {
  return <AboutStory />;
}
