import type { PublicGuide } from "@/lib/writing/public";

export default function LandingReadingCards({
  stories = [],
}: {
  stories?: PublicGuide[];
}) {
  return (
    <>
      {stories.length
        ? stories.slice(0, 3).map((s, i) => (
            <a
              href={`/guides/${s.slug}`}
              className={`landing-reading-card reading-card-${i}`}
              key={s.slug}
            >
              <span>{s.tags[0] || "From the community"}</span>
              <h3>{s.title}</h3>
              <p>{s.summary}</p>
              <div>
                <b>{s.authorName}</b>
                <span>Read story ↗</span>
              </div>
            </a>
          ))
        : [
            [
              "Discover",
              "An idea can change the way you see.",
              "Thoughtful guides and experiences, reviewed before publication.",
            ],
            [
              "Save",
              "A little library of things that matter.",
              "Keep stories you want to return to in your own reading library.",
            ],
            [
              "Share",
              "Your perspective belongs in the conversation.",
              "Create a public writer profile and develop your first story.",
            ],
          ].map(([tag, title, copy], i) => (
            <a
              key={tag}
              href={i === 2 ? "/writing" : "/community"}
              className={`landing-reading-card reading-card-${i}`}
            >
              <span>{tag}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <div>
                <b>On Syaahi</b>
                <span>Explore ↗</span>
              </div>
            </a>
          ))}
    </>
  );
}
