import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Respect rights and people",
    "Use only content you are allowed to upload and process. Do not submit stolen credentials, private records, exploitative material, or content intended to harass others. Obtain permission before uploading another person’s voice or private documents.",
  ],
  [
    "Learn honestly",
    "Use notes and practice to improve understanding. Follow your institution’s rules for assignments and exams. Do not represent AI-generated work as independently completed work where disclosure or independent work is required.",
  ],
  [
    "Respect the service",
    "Do not bypass access controls, forge payment events, scrape other accounts, attack infrastructure, or use multiple keys or identities to evade provider limits. Research and generation requests must remain within configured usage limits.",
  ],
  [
    "Report problems",
    "Report exposed data, suspicious output, or account misuse through Support. Avoid including credentials or unnecessary personal information. The operator may restrict misuse in accordance with applicable rules and law.",
  ],
];
export default function Policy() {
  return (
    <>
      <PageHero
        kicker="Trust & transparency"
        title="Acceptable use"
        lede="Keep the workspace useful, fair, and respectful."
      />
      <Prose>
        <p className="small">
          Updated 21 September 2026 · Current installation
        </p>
        {sections.map(([title, body], i) => (
          <section key={title}>
            <H>
              {i + 1}. {title}
            </H>
            <p>{body}</p>
          </section>
        ))}
        <p>
          Questions? <a href="/support">Contact the operator</a>.
        </p>
      </Prose>
    </>
  );
}
