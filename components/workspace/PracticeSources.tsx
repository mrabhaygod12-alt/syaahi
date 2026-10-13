import Link from "next/link";
import type { PracticeSource } from "@/lib/study/practice";

export default function PracticeSources({
  lesson,
  sources,
}: {
  lesson: string;
  sources?: PracticeSource[];
}) {
  if (!sources?.length)
    return (
      <p className="small">
        Built from this lesson’s notes. Review the material to verify important
        claims.
      </p>
    );
  return (
    <div className="practice-citations">
      <span>Supporting notes</span>
      {sources.map((source) => (
        <Link
          key={source.page}
          href={`/lesson/${lesson}/notes#page-${source.page + 1}`}
        >
          Section {source.page + 1} · {source.topic}
        </Link>
      ))}
      <small>
        These links identify supplied sections; AI explanations still need your
        review.
      </small>
    </div>
  );
}
