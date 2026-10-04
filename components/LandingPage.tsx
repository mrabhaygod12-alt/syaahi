import LandingMotion from "./LandingMotion";
import StudyDemo from "./StudyDemo";
import { Faq } from "./site";
import LandingStories from "./LandingStories";
export const LANDING_FAQS = [
  {
    q: "Can I use Syaahi for free?",
    a: "Yes. A new verified account receives 19 generation credits. Private writing and editorial submission are available on Free.",
  },
  {
    q: "Do I need another email to become a writer?",
    a: "No. Sign up as a writer using your existing email and password. Your writer profile is separate; your subscription and wallet remain shared.",
  },
  {
    q: "What happens after I submit an article?",
    a: "Your article stays private while editors review it. They can approve publication or request changes.",
  },
  {
    q: "Can I switch between learning and writing?",
    a: "Yes. Sign in with the workspace you want to use. Each space has its own navigation, profile and home.",
  },
];
export function PaperScene({ writer = false }: { writer?: boolean }) {
  return (
    <div
      className={writer ? "paper-scene writer-scene" : "paper-scene"}
      aria-label="Illustration of learning and writing on Syaahi"
    >
      <div className="scene-orbit" />
      <div className="scene-sphere" />
      <div className="scene-sheet rear-sheet" />
      <div className="scene-sheet front-sheet">
        <span>SYAAHI / {writer ? "YOUR NEXT STORY" : "YOUR NEXT IDEA"}</span>
        <h2>
          {writer ? (
            <>
              Ideas deserve
              <br />a little <em>space.</em>
            </>
          ) : (
            <>
              A little curiosity.
              <br />A lot of <em>possibility.</em>
            </>
          )}
        </h2>
        <div className="scene-lines">
          <i />
          <i />
          <i />
        </div>
        <div className="scene-sheet-bottom">
          <b>✦</b>
          <span>
            {writer ? "DRAFT · YOUR OWN VOICE" : "LEARN · CREATE · PUBLISH"}
          </span>
        </div>
      </div>
      <div className="scene-sticky">
        <span>Remember this.</span>
        <p>
          Great ideas
          <br />
          start with
          <br />
          <em>why.</em>
        </p>
      </div>
      <div className="scene-pill">✦ A place to begin</div>
    </div>
  );
}
export default function LandingPage() {
  return (
    <div className="landing-page">
      <LandingMotion />
      <div className="landing-scroll-progress" aria-hidden="true" />
      <section className="landing-hero">
        <div className="landing-wrap landing-hero-grid">
          <div className="landing-hero-copy" data-reveal>
            <p className="landing-eyebrow">A HOME FOR CURIOUS MINDS</p>
            <h1>
              <span>Learn something.</span>
              <span>Create something.</span>
              <em>Say something.</em>
            </h1>
            <p>
              Turn what you discover into what you understand—and what you
              understand into something worth sharing.
            </p>
            <div className="landing-actions">
              <a className="btn dark" href="/signup?workspace=student">
                Start learning ↗
              </a>
              <a className="btn light" href="/writing">
                Explore writing
              </a>
            </div>
            <a className="landing-scroll-link" href="#learn">
              <span>↓</span> Find your next possibility
            </a>
          </div>
          <PaperScene />
        </div>
      </section>
      <div className="landing-audience-strip">
        <span>FOR EVERY CURIOUS MIND</span>
        <p>
          Students <i>✦</i> Teachers <i>✦</i> Writers <i>✦</i> Lifelong learners
        </p>
      </div>
      <section id="learn" className="landing-wrap landing-split-section">
        <div
          className="landing-learning-art"
          data-reveal
          aria-label="Illustration of sources, notes and recall practice"
        >
          <div className="learning-source">
            <span>YOUR SOURCES</span>
            <b>
              One question.
              <br />A clearer picture.
            </b>
            <i />
            <i />
            <i />
          </div>
          <div className="learning-note">
            <span>01 / UNDERSTAND</span>
            <p>
              Connect the ideas.
              <br />
              Find the pattern.
              <br />
              <em>Make it yours.</em>
            </p>
            <svg viewBox="0 0 300 110" aria-hidden="true">
              <path d="M25 60C70 0 125 110 170 60S250 0 275 60" />
              <circle cx="25" cy="60" r="10" />
              <circle cx="170" cy="60" r="10" />
              <circle cx="275" cy="60" r="10" />
            </svg>
          </div>
          <div className="learning-recall">
            <span>02 / REMEMBER</span>
            <b>
              Can you explain it
              <br />
              without looking?
            </b>
            <div>Quiz · Flashcards · Progress</div>
          </div>
        </div>
        <div data-reveal>
          <p className="landing-eyebrow">FOR THE MOMENT IT CLICKS</p>
          <h2>
            Less collecting.
            <br />
            <em>More understanding.</em>
          </h2>
          <p>
            Bring a topic, a lecture or a source. Build notes you can use,
            questions that make you think, and a study routine you can return
            to.
          </p>
          <div className="landing-feature-list">
            <div>
              <span>01</span>
              <p>
                <strong>Start with your material</strong>Keep sources close to
                the explanation.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Make the idea clear</strong>Notes, diagrams and editable
                presentations.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Find out what stays</strong>Quizzes, flashcards and
                saved progress.
              </p>
            </div>
          </div>
          <a className="landing-text-link" href="/dashboard">
            Explore the learning workspace ↗
          </a>
        </div>
      </section>
      <section className="landing-writer-band" id="write">
        <div className="landing-wrap landing-split-section">
          <div data-reveal>
            <p className="landing-eyebrow">YOUR WORDS. YOUR PERSPECTIVE.</p>
            <h2>
              The world has stories.
              <br />
              <em>It needs yours, too.</em>
            </h2>
            <p>
              A focused editor. Room to revise. A profile to call your own.
              Write a guide, share an experience or follow an idea all the way
              through.
            </p>
            <div className="landing-actions">
              <a className="btn gold" href="/signup?workspace=writer">
                Find your writing space ↗
              </a>
              <a href="/writing">Meet the writer experience →</a>
            </div>
            <div className="writer-band-steps">
              <span>01 Draft</span>
              <i>→</i>
              <span>02 Refine</span>
              <i>→</i>
              <span>03 Editorial review</span>
            </div>
          </div>
          <div className="landing-writer-art" data-reveal>
            <div className="writer-art-toolbar">
              <span>B</span>
              <em>I</em>
              <u>U</u>
              <span>≡</span>
              <span>＋</span>
              <b>Saved ✓</b>
            </div>
            <div className="writer-art-page">
              <span>A DRAFT IN SYAAHI</span>
              <h3>
                The art of
                <br />
                <em>paying attention.</em>
              </h3>
              <p>
                Good ideas have a way of hiding in ordinary moments. Give them a
                page of their own.
              </p>
              <div className="writer-art-cursor" />
              <i />
              <i />
            </div>
            <div className="writer-art-note">
              Private until
              <br />
              you're ready.
            </div>
          </div>
        </div>
      </section>
      <section className="landing-wrap landing-reading-section">
        <div className="landing-section-heading" data-reveal>
          <div>
            <p className="landing-eyebrow">READ SOMETHING THAT STAYS</p>
            <h2>
              Ideas worth
              <br />
              <em>slowing down for.</em>
            </h2>
          </div>
          <p>
            Discover reviewed stories from people who care about what they
            share. Save a favourite. Follow your curiosity.
          </p>
        </div>
        <div className="landing-reading-grid" data-reveal>
          <LandingStories />
        </div>
        <a className="landing-text-link" href="/community">
          Discover the community →
        </a>
      </section>
      <section className="landing-wrap landing-tools-section">
        <div className="landing-section-heading" data-reveal>
          <div>
            <p className="landing-eyebrow">
              ONE IDEA. MANY WAYS TO MAKE IT REAL.
            </p>
            <h2>
              From a spark
              <br />
              <em>to something useful.</em>
            </h2>
          </div>
          <p>Choose the format that helps your idea travel.</p>
        </div>
        <div className="landing-tools-grid">
          {[
            [
              "▤",
              "Notes you can hold",
              "Printable notes, diagrams and sources.",
              "/examples",
            ],
            [
              "▥",
              "A presentation with purpose",
              "Editable slides, charts and speaker notes.",
              "/presentations",
            ],
            [
              "✎",
              "Words in your own voice",
              "Private drafts, rich formatting and revisions.",
              "/writing",
            ],
            [
              "◌",
              "Practice that builds confidence",
              "Recall questions and mock interviews.",
              "/interview",
            ],
          ].map(([icon, title, copy, href]) => (
            <a key={title} href={href} data-reveal>
              <span className="landing-tool-icon">{icon}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <b>Explore ↗</b>
            </a>
          ))}
        </div>
      </section>
      <div className="landing-demo-frame" data-reveal>
        <StudyDemo />
      </div>
      <section className="landing-wrap landing-principles">
        <div data-reveal>
          <p className="landing-eyebrow">THOUGHTFULLY BUILT</p>
          <h2>
            Your work.
            <br />
            <em>Your decisions.</em>
          </h2>
          <p>
            Keep your drafts private. Check AI explanations against original
            sources. Publish work you have the right to share.
          </p>
          <a href="/about" className="landing-text-link">
            Meet the people behind Syaahi ↗
          </a>
        </div>
        <div className="landing-principle-cards" data-reveal>
          <article>
            <span>✦</span>
            <h3>Private by default.</h3>
            <p>Your work stays in your account until you choose to share it.</p>
          </article>
          <article>
            <span>↗</span>
            <h3>A thoughtful publishing process.</h3>
            <p>
              Articles go through editorial review. Paid plans do not buy
              approval.
            </p>
          </article>
          <article>
            <span>◎</span>
            <h3>One account. Separate spaces.</h3>
            <p>
              Student and writer profiles stay distinct. Your plan and wallet
              stay together.
            </p>
          </article>
        </div>
      </section>
      <section className="landing-wrap landing-faq" data-reveal>
        <Faq items={LANDING_FAQS} />
      </section>
      <section className="landing-final-section" data-reveal>
        <p className="landing-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
        <h2>
          Stay curious.
          <br />
          <em>Make something.</em>
        </h2>
        <div className="landing-actions">
          <a className="btn gold" href="/signup?workspace=student">
            Start learning ↗
          </a>
          <a className="btn light" href="/signup?workspace=writer">
            Start writing ↗
          </a>
        </div>
        <p>One account. Two distinct spaces. Yours to explore.</p>
        <span className="landing-final-star" aria-hidden="true">
          ✦
        </span>
      </section>
    </div>
  );
}
