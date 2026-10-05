import { pageMeta, writingSchema, jsonLd } from "@/lib/seo";
import { PaperScene } from "@/components/LandingPage";
import LandingMotion from "@/components/LandingMotion";
import WriterStartLink from "@/components/writer/WriterStartLink";
export const metadata = pageMeta({
  title: "Blog writing, public profiles and reviewed publishing",
  path: "/writing",
  description:
    "A focused writing space with private drafts, article design and a public writer profile. Write on Syaahi.",
});
export default function Writing() {
  return (
    <div className="landing-page writer-public-landing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(writingSchema()) }}
      />
      <LandingMotion />
      <section className="landing-hero">
        <div className="landing-wrap landing-hero-grid">
          <div data-reveal className="landing-hero-copy">
            <p className="landing-eyebrow">SYAAHI FOR WRITERS</p>
            <h1>
              Some ideas
              <br />
              deserve
              <br />
              <em>a page of their own.</em>
            </h1>
            <p>
              A quiet space to write. Tools to shape your story. A thoughtful
              community to share it with.
            </p>
            <div className="landing-actions">
              <WriterStartLink />
              <a href="/login?workspace=writer">Writer sign in →</a>
            </div>
          </div>
          <PaperScene writer />
        </div>
      </section>
      <section className="landing-wrap writing-feature-section" id="workflow">
        <p className="landing-eyebrow" data-reveal>
          FROM THE FIRST LINE TO THE FINAL READ
        </p>
        <h2 data-reveal>
          Take your time.
          <br />
          <em>Make it yours.</em>
        </h2>
        <div className="landing-tools-grid">
          {[
            [
              "01",
              "A focused editor",
              "Fonts, images, tables, equations and article design, with fewer distractions.",
            ],
            [
              "02",
              "Room to revise",
              "Private drafts, autosave and earlier versions—ready for your next thought.",
            ],
            [
              "03",
              "Your own identity",
              "A public name, photo and About page, separate from your student profile.",
            ],
            [
              "04",
              "Thoughtful publication",
              "Submit when you're ready. Editorial review helps keep public writing accountable.",
            ],
          ].map(([n, t, c]) => (
            <article data-reveal key={n}>
              <span className="landing-tool-icon">{n}</span>
              <h3>{t}</h3>
              <p>{c}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-writer-band">
        <div className="landing-wrap writing-community">
          <div data-reveal>
            <p className="landing-eyebrow">A PLACE TO READ, TOO</p>
            <h2>
              Your next idea
              <br />
              <em>might start with a story.</em>
            </h2>
            <p>
              Discover reviewed guides and experiences. Save stories worth
              returning to.
            </p>
            <a className="btn gold" href="/community">
              Explore the community ↗
            </a>
          </div>
          <div className="writing-quote-art" data-reveal aria-hidden="true">
            <span>“</span>
            <p>
              Curiosity is a good
              <br />
              place to start.
            </p>
            <i>READ. THINK. WRITE.</i>
          </div>
        </div>
      </section>
      <section className="landing-wrap writing-faq" data-reveal>
        <div className="product-link-row">
          <a href="/writing/features">All writer features</a>
          <a href="/writing/pricing">Free and Max pricing</a>
          <a href="/writing/medium-comparison">Medium capability comparison</a>
        </div>
        <h2>A space that stays yours.</h2>
        <details>
          <summary>Already a student on Syaahi?</summary>
          <p>
            Sign up as a writer with your existing email and password. You keep
            one account, one wallet and one membership, with a separate writer
            profile.
          </p>
        </details>
        <details>
          <summary>Do articles publish immediately?</summary>
          <p>
            No. Stories stay private until editorial approval. You can follow
            the submission status and feedback in Your stories.
          </p>
        </details>
        <details>
          <summary>Does writing require membership?</summary>
          <p>
            Core drafting and submission are included on Free. Paid plans add
            generation credits; they do not guarantee approval.
          </p>
        </details>
      </section>
      <section className="landing-final-section" data-reveal>
        <p className="landing-eyebrow">YOUR FIRST SENTENCE IS WAITING</p>
        <h2>
          Find your voice.
          <br />
          <em>Give it a home.</em>
        </h2>
        <WriterStartLink />
      </section>
    </div>
  );
}
