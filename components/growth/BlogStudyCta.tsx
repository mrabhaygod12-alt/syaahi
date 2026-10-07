import { learningLink } from "@/lib/growth/samples";
export default function BlogStudyCta({ topic }: { topic: string }) {
  return (
    <aside className="card" style={{ marginBlock: 32, background: "#f1f6ef" }}>
      <p className="eyebrow">PUT THE IDEA INTO PRACTICE</p>
      <h2>Make a revision lesson for this topic.</h2>
      <p>Bring your course material, review an outline and practise recall.</p>
      <a className="btn dark" href={learningLink(topic)}>
        Start with this topic →
      </a>{" "}
      <a href="/resources">Download a free revision worksheet</a>
    </aside>
  );
}
