import StudyDemo from "@/components/StudyDemo";
import FeatureJourney from "@/components/FeatureJourney";
import { CtaBand, Faq } from "@/components/site";
import { PRODUCT_FAQS } from "@/lib/product-copy";
import { pageMeta, jsonLd, faqSchema, SITE } from "@/lib/seo";

export const metadata = pageMeta({
  title: "AI Notes, Presentations & Blog Writing",
  path: "/",
  description:
    "Learn, teach and write with Syaahi. Create source-aware notes and editable presentations, or publish reviewed articles with headings, images and your own profile.",
});

const audiences = [
  [
    "Students",
    "Turn course material into notes, quiz yourself and review due flashcards.",
    "/examples",
    "See a learning example",
  ],
  [
    "Teachers",
    "Prepare explanations and slides, then write a guide your readers can revisit.",
    "/writing#teachers",
    "Explore teaching workflows",
  ],
  [
    "Professionals",
    "Work through a technical topic, create a presentation and write about your experience.",
    "/writing#professionals",
    "Explore professional workflows",
  ],
  [
    "Writers",
    "Draft with headings and photos, keep revisions and submit your article for review.",
    "/writing",
    "Explore the writing workspace",
  ],
] as const;

const tools = [
  [
    "Notes and printable PDFs",
    "Review a source and outline. Generate handwritten-style notes with templates, diagrams and continuation pages.",
    "/examples",
  ],
  [
    "Editable AI presentations",
    "Describe your audience and topic, supply references and export a PowerPoint deck with editable text, charts and speaker notes.",
    "/presentations",
  ],
  [
    "Lesson tutor and sources",
    "Ask about the current lesson while keeping supplied material and retrieved-reference labels available for review.",
    "/docs/getting-started",
  ],
  [
    "Flashcards, quizzes and progress",
    "Practise recall, review weak concepts and return to saved lessons and due cards.",
    "/how-it-works",
  ],
  [
    "Rich writing and images",
    "Write articles with headings, lists, links and uploaded images. Add descriptions so images are accessible to readers.",
    "/writing",
  ],
  [
    "Private drafts and revisions",
    "Save as you write, reopen your work and restore earlier draft versions before submitting for review.",
    "/writing#workflow",
  ],
  [
    "Public articles and profiles",
    "Approved articles get a public URL and creator attribution. Readers can bookmark, upvote or report an article.",
    "/community",
  ],
  [
    "Voice mock interviews",
    "Practise speaking for a target role, save an interview session and return to its feedback.",
    "/interview",
  ],
  [
    "Source documents and course packs",
    "Work with uploaded source material or a course-outline starter. Confirm that a course pack matches your current syllabus.",
    "/course-packs",
  ],
  [
    "Learning languages and audio",
    "Generate in six languages and use spoken study explanations when the audio service is available.",
    "/features",
  ],
] as const;

export default function Home() {
  return (
    <div className="syaahi-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "@id": `${SITE.url}/#application`,
            name: SITE.name,
            alternateName: "Syaahii",
            url: `${SITE.url}/`,
            operatingSystem: "Web browser",
            applicationCategory: "EducationalApplication",
            description: SITE.description,
            publisher: { "@id": `${SITE.url}/#organization` },
            audience: ["Students", "Teachers", "Professionals", "Writers"].map(
              (audienceType) => ({ "@type": "Audience", audienceType }),
            ),
            featureList: tools.map(([title]) => title),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(faqSchema([...PRODUCT_FAQS])),
        }}
      />

      <section className="public-hero home-hero">
        <div className="wrap home-hero-grid">
          <div className="home-hero-copy">
            <p className="eyebrow">SYAAHI · LEARN, CREATE, PUBLISH</p>
            <h1>
              Create notes and presentations.
              <br />
              <em>Write and publish articles.</em>
            </h1>
            <p>
              Turn source material into notes and presentations. Write articles
              with headings and images, then publish after editorial review. A
              workspace for students, teachers, professionals and writers.
            </p>
            <div className="hero-actions">
              <a className="btn dark" href="/signup?workspace=student">
                Learn &amp; create
              </a>
              <a className="btn light" href="/signup?workspace=writer">
                Write &amp; publish
              </a>
            </div>
            <p className="small">
              One account, two workspaces. Start free and switch whenever you
              need.
            </p>
            <a className="home-demo-link" href="#try-demo">
              Try the learning sample ↓
            </a>
          </div>
          <div
            className="home-workflow-preview"
            aria-label="Illustration of the two Syaahi workflows"
          >
            <p className="eyebrow">TWO WAYS TO WORK WITH AN IDEA</p>
            <div className="home-preview-note">
              <span>01 / LEARN &amp; CREATE</span>
              <p className="home-ink">
                Start with the source.
                <br />
                Explain the idea.
                <br />
                Check what you remember.
              </p>
              <div>Source → Notes → Practice</div>
            </div>
            <div className="home-preview-story">
              <span>02 / WRITE &amp; PUBLISH</span>
              <p>
                Give your knowledge
                <br />a page of its own.
              </p>
              <div>Draft → Review → Public article</div>
            </div>
            <p className="small">
              Workflow illustration. Your own work stays private until you share
              or publish it.
            </p>
          </div>
        </div>
      </section>

      <section className="wrap home-section" aria-labelledby="workspace-paths">
        <p className="eyebrow">CHOOSE YOUR STARTING POINT</p>
        <h2 id="workspace-paths">Two workspaces. One account.</h2>
        <p className="home-section-lede">
          Choose a dashboard that fits today's work. Your account gives you
          access to both.
        </p>
        <div className="home-path-grid">
          <article className="home-path-card">
            <span className="home-path-index">01</span>
            <h3>Learn &amp; create</h3>
            <p>
              For a lecture, classroom topic, certification or professional
              subject you want to understand and explain.
            </p>
            <ul>
              <li>Source-aware notes and printable PDFs</li>
              <li>Lesson tutor, flashcards, quizzes and saved progress</li>
              <li>Editable AI presentations from your brief</li>
            </ul>
            <a className="btn dark" href="/dashboard?view=student">
              Open the learning workspace
            </a>
          </article>
          <article className="home-path-card home-path-writing">
            <span className="home-path-index">02</span>
            <h3>Write &amp; publish</h3>
            <p>
              For a tutorial, teaching guide, professional explanation or
              article you want to develop in your own voice.
            </p>
            <ul>
              <li>Rich editor with headings, lists, links and images</li>
              <li>Private drafts, autosave and revision history</li>
              <li>Reviewed publication with a public creator profile</li>
            </ul>
            <a className="btn dark" href="/writer">
              Open the writer dashboard
            </a>
          </article>
        </div>
      </section>

      <section
        className="wrap home-section home-audiences"
        aria-labelledby="who-syaahi-serves"
      >
        <p className="eyebrow">FOR THE WORK YOU DO</p>
        <h2 id="who-syaahi-serves">
          From the classroom to your professional practice.
        </h2>
        <div className="home-audience-grid">
          {audiences.map(([title, copy, href, link]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
              <a href={href}>{link} →</a>
            </article>
          ))}
        </div>
      </section>

      <StudyDemo />
      <FeatureJourney />

      <section
        className="wrap home-section"
        id="publish-workflow"
        aria-labelledby="publish-title"
      >
        <p className="eyebrow">THE WRITING WORKSPACE</p>
        <h2 id="publish-title">
          A draft you can shape. An article you can stand behind.
        </h2>
        <p className="home-section-lede">
          Use your own explanation and experience. Add structure, illustrate a
          point and check your sources before sharing it.
        </p>
        <ol className="home-publish-steps">
          <li>
            <span>01</span>
            <h3>Write and illustrate</h3>
            <p>
              Add a title, headings, lists, links and your uploaded images.
              Preview the article as you work.
            </p>
          </li>
          <li>
            <span>02</span>
            <h3>Save and revise</h3>
            <p>
              Keep a private draft, reopen it later and restore an earlier saved
              version if your direction changes.
            </p>
          </li>
          <li>
            <span>03</span>
            <h3>Submit for review</h3>
            <p>
              Check your claims and image rights. Editorial review can approve
              the work or request changes.
            </p>
          </li>
          <li>
            <span>04</span>
            <h3>Publish with attribution</h3>
            <p>
              An approved article has a public URL and creator link, with
              bookmarking and content reporting for readers.
            </p>
          </li>
        </ol>
        <div className="hero-actions">
          <a className="btn dark" href="/signup?workspace=writer">
            Start a private draft
          </a>
          <a href="/writing">See how writing works →</a>
          <a href="/community">Read community articles →</a>
        </div>
      </section>

      <section className="wrap home-section" aria-labelledby="available-tools">
        <p className="eyebrow">AVAILABLE IN SYAAHI</p>
        <h2 id="available-tools">
          Tools for learning, teaching and publishing.
        </h2>
        <div className="home-tool-grid">
          {tools.map(([title, copy, href]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
              <a href={href}>Explore {title.toLowerCase()} →</a>
            </article>
          ))}
        </div>
      </section>

      <section
        className="wrap home-section home-facts"
        aria-labelledby="what-is-syaahi"
      >
        <div>
          <p className="eyebrow">ABOUT THE PLATFORM</p>
          <h2 id="what-is-syaahi">What is Syaahi?</h2>
          <p>
            Syaahi is a learning and writing platform at{" "}
            <strong>syaahii.in</strong>. Students, teachers, professionals and
            writers can create source-aware notes and editable presentations, or
            write and publish reviewed articles. The learning and writer
            dashboards share one account.
          </p>
          <p>
            Chandan Pandey and Manish Kumar Singh build Syaahi. Read their story
            and the product's approach to source transparency, privacy and
            responsible AI use.
          </p>
          <a href="/about">Meet the people behind Syaahi →</a>
        </div>
        <div>
          <h3>Keep ownership of the decision.</h3>
          <p>
            Private work stays private unless you share it or it passes
            publication review. AI output needs your factual checks. Only
            publish text and images you have the right to use.
          </p>
          <p>
            Writing is available on Free. Paid monthly plans add generation
            credits; they do not guarantee publication, audience size or
            professional outcomes.
          </p>
          <nav aria-label="Platform policies">
            <a href="/privacy">Privacy</a>
            <a href="/acceptable-use">Content rules</a>
            <a href="/pricing">Plans and limits</a>
            <a href="/support">Support</a>
          </nav>
        </div>
      </section>
      <Faq items={[...PRODUCT_FAQS]} />
      <CtaBand />
    </div>
  );
}
