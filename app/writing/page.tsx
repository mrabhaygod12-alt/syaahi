import { CtaBand, Faq } from "@/components/site";
import { PRODUCT_FAQS } from "@/lib/product-copy";
import { breadcrumbSchema, faqSchema, jsonLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Blog Writing & Publishing for Teachers and Professionals",
  description:
    "Write articles and teaching guides on Syaahi with headings, images and revision history. Keep private drafts and publish reviewed work with creator attribution.",
  path: "/writing",
});
const answers = [
  PRODUCT_FAQS[1],
  PRODUCT_FAQS[2],
  PRODUCT_FAQS[5],
  PRODUCT_FAQS[6],
  PRODUCT_FAQS[8],
];

export default function WritingPage() {
  return (
    <div className="writing-overview">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: "Syaahi", path: "/" },
              { name: "Writing and publishing", path: "/writing" },
            ]),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(answers)) }}
      />
      <section className="public-hero">
        <div className="wrap home-hero-grid">
          <div className="home-hero-copy">
            <p className="eyebrow">THE SYAAHI WRITING WORKSPACE</p>
            <h1>
              Write articles with headings and images.
              <br />
              <em>Keep drafts. Publish reviewed work.</em>
            </h1>
            <p>
              Teachers, professionals and writers can develop articles,
              tutorials and learning guides in Writer Studio. Add headings and
              images, save privately and submit when the work is ready for
              editorial review.
            </p>
            <div className="hero-actions">
              <a className="btn dark" href="/signup?workspace=writer">
                Start writing free
              </a>
              <a className="btn light" href="/community">
                Read community articles
              </a>
            </div>
            <p className="small">
              Existing account?{" "}
              <a href="/login?workspace=writer">
                Sign in to the writer workspace
              </a>
              .
            </p>
          </div>
          <aside className="home-workflow-preview">
            <p className="eyebrow">WHAT THE EDITOR SUPPORTS</p>
            <div className="home-preview-story">
              <span>YOUR DRAFT</span>
              <p>
                A clear title.
                <br />A point worth explaining.
              </p>
              <ul>
                <li>Headings, paragraphs and lists</li>
                <li>Emphasis, quotes and links</li>
                <li>Uploaded images with descriptions</li>
                <li>Reader preview and saved revisions</li>
              </ul>
            </div>
            <p className="small">
              An illustration of the writing workflow. Your draft is private
              until approved publication.
            </p>
          </aside>
        </div>
      </section>
      <section className="wrap home-section" id="workflow">
        <p className="eyebrow">FROM FIRST DRAFT TO PUBLIC ARTICLE</p>
        <h2>Write, revise and publish with a clear review process.</h2>
        <ol className="home-publish-steps">
          <li>
            <span>01</span>
            <h3>Choose the writing workspace</h3>
            <p>
              Select Write &amp; publish at signup or login. Your writer
              dashboard shows drafts, review feedback and published work.
            </p>
          </li>
          <li>
            <span>02</span>
            <h3>Shape the article</h3>
            <p>
              Write in your own voice. Use headings, links and illustrations to
              explain the subject. Add image descriptions and credit sources.
            </p>
          </li>
          <li>
            <span>03</span>
            <h3>Check and submit</h3>
            <p>
              Preview the article, check factual claims and confirm your rights
              to the text and images. Reviewers can request changes.
            </p>
          </li>
          <li>
            <span>04</span>
            <h3>Share the approved work</h3>
            <p>
              Approved articles have a public page with creator attribution.
              Readers can bookmark, upvote and report content.
            </p>
          </li>
        </ol>
        <a href="/write">Open Writer Studio →</a>
      </section>
      <section
        className="wrap home-section home-path-grid"
        aria-label="Writing use cases"
      >
        <article className="home-path-card" id="teachers">
          <p className="eyebrow">FOR TEACHERS</p>
          <h2>Make an explanation students can return to.</h2>
          <p>
            Write a concept guide, worked example or revision method. Use an
            illustration you own, explain the reasoning and link the original
            reference. You can use the learning workspace to prepare your own
            notes and slides, then review them before teaching or publication.
          </p>
          <p>
            Class materials and student information need care. Do not upload
            confidential records or identifying student data without appropriate
            permission.
          </p>
          <a href="/presentations">Explore presentation creation →</a>
        </article>
        <article
          className="home-path-card home-path-writing"
          id="professionals"
        >
          <p className="eyebrow">FOR PROFESSIONALS</p>
          <h2>Explain a method, a topic or a lesson from practice.</h2>
          <p>
            Write a technical tutorial, a professional learning guide or a
            practical explanation. Add your experience, separate evidence from
            opinion and show readers where important claims come from.
          </p>
          <p>
            Use material you are allowed to share. Remove client details,
            confidential business information and personal data. Publication on
            Syaahi is not professional certification or employer endorsement.
          </p>
          <a href="/writer">Open the writer dashboard →</a>
        </article>
      </section>
      <section className="wrap home-section home-facts">
        <div>
          <p className="eyebrow">ONE ACCOUNT, BOTH WORKSPACES</p>
          <h2>Research an idea. Write it for someone else.</h2>
          <p>
            The learning dashboard helps you organise sources, generate notes,
            practise recall and create presentations. The writer dashboard helps
            you develop drafts and follow them through review. You can switch
            between them without creating another account.
          </p>
          <p>
            Generation supports English, Hindi, Hinglish, German, French and
            Spanish. You can enter your own article text in your language. Share
            approved articles with readers around the world. Always review
            translations, technical terminology and AI-generated content.
          </p>
          <a href="/features">Compare available tools →</a>
        </div>
        <div>
          <h3>Publication requires review.</h3>
          <p>
            Free includes private drafting and submission. Paid plans add
            generation credits and presentation limits; they do not buy
            editorial approval or a promised audience.
          </p>
          <p>
            Authors remain responsible for their work. Reports can lead to
            investigation and removal. Public articles and creator profiles can
            be found through links and search engines after publication.
          </p>
          <nav aria-label="Writing policies">
            <a href="/acceptable-use">Content rules</a>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/support">Report a concern</a>
          </nav>
        </div>
      </section>
      <Faq items={answers} />
      <CtaBand />
    </div>
  );
}
