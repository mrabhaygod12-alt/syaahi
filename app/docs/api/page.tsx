import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Authentication",
    "Private endpoints require the HttpOnly session cookie issued by POST /api/auth. Use the app login flow. Browser display caches are not proof of identity. Cross-origin mutations are rejected.",
  ],
  [
    "Planning and generation",
    "POST /api/plan accepts topic, pages, context, and research. POST /api/jobs accepts topics, style, language, and context. GET /api/jobs lists only the signed-in account’s jobs. GET /api/jobs/:id returns an owned job.",
  ],
  [
    "Lesson actions",
    "POST /api/jobs/:id supports progress, resume, append-page, and edit-page actions. DELETE removes an inactive lesson. Edits and appends are rejected while generation is running.",
  ],
  [
    "Material intake",
    "POST /api/syllabus, /api/image, and /api/transcribe accept multipart file uploads. POST /api/youtube accepts a video URL. These routes require authentication and enforce input limits.",
  ],
  [
    "Study and export",
    "POST /api/ask and /api/ask-stream answer from submitted notes. POST /api/practice generates validated practice items. POST /api/interview provides coaching. POST /api/export renders authenticated note exports.",
  ],
  [
    "Deployment constraints",
    "This is an application API, not a public API-key service. Deploy on Node 24 with persistent local storage and Chromium installed. Run the job worker alongside the web process. Multi-host deployments require shared database and queue architecture.",
  ],
];
export default function Guide() {
  return (
    <>
      <PageHero
        kicker="Syaahi documentation"
        title="Application API reference"
        lede="Practical guidance for the current application."
      />
      <Prose>
        <a href="/docs">← All guides</a>
        {sections.map(([title, body]) => (
          <section key={title}>
            <H>{title}</H>
            <p>{body}</p>
          </section>
        ))}
        <p className="small">Updated 22 September 2026</p>
      </Prose>
    </>
  );
}
