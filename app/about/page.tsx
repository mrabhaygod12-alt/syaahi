import AboutStory from "@/components/AboutStory";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "About Chandan, Manish and Syaahi",
  path: "/about",
  description:
    "Meet creator Chandan Pandey and Manish Kumar Singh, DevOps Engineer & Researcher, and explore the people behind Syaahi.",
});
export default function About() {
  return <AboutStory />;
}
