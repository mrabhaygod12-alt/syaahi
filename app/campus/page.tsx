import CampusApplication from "@/components/CampusApplication";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Campus ambassador pilot",
  description:
    "Apply to help students pilot Syaahi with reviewed course outlines, honest feedback and responsible study workshops.",
  path: "/campus",
});
export default function Page() {
  return (
    <main className="wrap feature-section">
      <p className="eyebrow">SYAAHI ON CAMPUS</p>
      <h1>Help your classmates study with better sources.</h1>
      <p>
        Our campus pilot starts with small study groups: check course outlines,
        run a practical workshop, and report what helps students learn.
        University names identify the intended learner audience; they do not
        imply endorsement.
      </p>
      <div className="steps-grid">
        <article className="card">
          <h2>Review a course outline</h2>
          <p>
            Use an authorised syllabus, identify gaps and submit corrections
            before sharing a study guide.
          </p>
          <a href="/course-packs">Explore course starters →</a>
        </article>
        <article className="card">
          <h2>Run a study session</h2>
          <p>
            Demonstrate source checking, note creation and active recall. Obtain
            consent before sharing anyone's work or feedback.
          </p>
        </article>
        <article className="card">
          <h2>Share useful feedback</h2>
          <p>
            Collect problems and suggestions without collecting classmates'
            passwords or private account data.
          </p>
        </article>
      </div>
      <CampusApplication />
    </main>
  );
}
