import Image from "next/image";
const stages = [
  [
    "The starting point",
    "A clearer way to study",
    "Dense source material can make revision harder than it needs to be. Syaahi starts with the learner’s material and an editable outline.",
  ],
  [
    "The craft",
    "A notebook that explains",
    "Handwriting, diagrams, formulas and worked examples should help understanding. Long explanations continue onto another sheet instead of stretching the page.",
  ],
  [
    "The learning loop",
    "Recall, reflect, return",
    "Notes lead into quizzes, flashcards and questions. Saved review dates and weak concepts help learners decide what to revisit.",
  ],
  [
    "The responsibility",
    "Build trust through evidence",
    "Source visibility, private accounts, explicit sharing and verified payments are part of the product. AI output still needs human judgement.",
  ],
  [
    "The direction",
    "Earn the next step",
    "The roadmap is to improve learning quality, accessibility and reliability through testing and feedback. Scale and security claims must be backed by measurements.",
  ],
];
export default function AboutStory() {
  return (
    <div className="wrap about-page">
      <section className="about-hero">
        <div>
          <p className="eyebrow">ABOUT THE CREATORS</p>
          <h1>
            Meet the people
            <br />
            <em>building Syaahi.</em>
          </h1>
          <p className="about-lead">
            I’m Chandan Pandey, the creator of Syaahi. I’m building a study
            space where a difficult idea becomes something you can see, question
            and remember.
          </p>
          <p className="about-lead">
            <strong>Manish Kumar Singh</strong> builds alongside me as a{" "}
            <strong>DevOps Engineer &amp; Researcher</strong>.
          </p>
          <div className="about-tags">
            <span>Developer</span>
            <span>Security practitioner</span>
            <span>Learner</span>
          </div>
        </div>
        <figure>
          <Image
            src="/team/chandan-pandey.jpeg"
            alt="Chandan Pandey, creator of Syaahi"
            width="640"
            height="760"
            sizes="(max-width: 760px) 100vw, 42vw"
          />
          <figcaption>Chandan Pandey · Creator, Syaahi</figcaption>
        </figure>
      </section>
      <section className="about-bio card" data-story>
        <p className="eyebrow">A LITTLE ABOUT ME</p>
        <h2>Learning and building belong together.</h2>
        <p>
          I am pursuing an MSc in Digital Forensics and Cyber Security at Lovely
          Professional University (LPU). I have four years of experience in web
          application development and security assessment.
        </p>
        <p>
          That background shapes how I approach Syaahi: make the interface
          understandable, protect access to private material, and test the
          important workflows before making promises.
        </p>
        <div className="about-socials">
          {[
            ["Portfolio", "https://chandanpandeyprot.netlify.app/"],
            [
              "LinkedIn",
              "https://www.linkedin.com/in/chandan-pandey-5b255a3aa",
            ],
            ["GitHub", "https://github.com/thecnical"],
            ["X", "https://x.com/CPandey8752"],
          ].map(([name, url]) => (
            <a
              className="btn light"
              href={url}
              key={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {name} ↗
            </a>
          ))}
        </div>
      </section>
      <section
        className="about-hero about-team-profile"
        aria-labelledby="manish-heading"
        data-story
      >
        <div>
          <p className="eyebrow">ABOUT THE CO-CREATOR</p>
          <h2 id="manish-heading">
            Manish Kumar Singh
            <br />
            <em>DevOps &amp; Research.</em>
          </h2>
          <p className="about-lead">
            I’m Manish Kumar Singh, DevOps Engineer &amp; Academic Researcher at
            Syaahi. I focus on architecting resilient cloud infrastructure,
            container orchestration, and researching high-retention learning
            workflows.
          </p>
          <p className="about-lead">
            I work alongside Chandan on deployment, infrastructure and
            operational reliability. We measure performance and improve the
            system as real usage and feedback show where it needs attention.
          </p>
          <div className="about-tags">
            <span>DevOps Engineer</span>
            <span>Cloud Infrastructure</span>
            <span>Research</span>
            <span>CI/CD &amp; Docker</span>
            <span>System Reliability</span>
          </div>
        </div>
        <figure>
          <Image
            src="/team/manish-kumar-singh.png"
            alt="Manish Kumar Singh, DevOps Engineer and Researcher at Syaahi"
            width={640}
            height={760}
            sizes="(max-width: 760px) 100vw, 42vw"
          />
          <figcaption>
            Manish Kumar Singh · DevOps Engineer &amp; Researcher, Syaahi
          </figcaption>
        </figure>
      </section>
      <section className="about-bio card" data-story>
        <p className="eyebrow">ENGINEERING &amp; RESEARCH PHILOSOPHY</p>
        <h2>Reliable systems, improved with evidence.</h2>
        <p>
          Study tools need to respond predictably, especially when learners
          return to saved work or generate a new study set. Reliability is a
          product goal that we measure and improve; it is not a promise of zero
          downtime.
        </p>
        <p>
          Syaahi separates its web experience from its API and generation
          worker. The interface is delivered through Vercel, while Render runs
          API and background generation services. MongoDB Atlas stores
          application data, and health checks help us spot service failures.
        </p>
        <p>
          We explore how explanations, visual notes and active-recall activities
          can support a learner's study routine. These product choices are not
          claims of proven learning outcomes; we use feedback and testing to
          guide improvements.
        </p>
        <div className="about-socials">
          <span
            className="btn light"
            style={{ cursor: "default", fontWeight: 700 }}
          >
            ⚡ Infrastructure &amp; DevOps
          </span>
          <span
            className="btn light"
            style={{ cursor: "default", fontWeight: 700 }}
          >
            🧠 Cognitive Science Research
          </span>
          <a className="btn dark" href="/support">
            Connect with Us ↗
          </a>
        </div>
      </section>
      <section className="about-journey">
        <p className="eyebrow">THE PRODUCT JOURNEY</p>
        <h2>
          From information
          <br />
          to understanding.
        </h2>
        <p>
          Our design journey and direction, rather than a dated release history.
        </p>
        <ol>
          {stages.map(([label, title, body], i) => (
            <li key={label} data-story>
              <span className="journey-number">0{i + 1}</span>
              <div>
                <p className="eyebrow">{label}</p>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="about-principles card" data-story>
        <p className="eyebrow">WHAT WE OWE THE LEARNER</p>
        <h2>Useful tools. Honest limits.</h2>
        <div className="about-principle-grid">
          <div>
            <h3>Clarity</h3>
            <p>
              Review your outline. Edit your notes. Know what your source
              supports and what needs checking.
            </p>
          </div>
          <div>
            <h3>Control</h3>
            <p>
              Keep lessons private by default. Choose who receives a sharing
              link and revoke it when needed.
            </p>
          </div>
          <div>
            <h3>Accountability</h3>
            <p>
              Security work is guided by the NIST CSF functions: Govern,
              Identify, Protect, Detect, Respond and Recover. This is a
              framework for improvement, not a claim of certification.
            </p>
          </div>
        </div>
        <a href="/docs">Explore how Syaahi works →</a>
      </section>
      <section className="about-closing" data-story>
        <h2>
          Your next insight
          <br />
          starts with a question.
        </h2>
        <a className="btn dark" href="/dashboard">
          Open your workspace ↗
        </a>
      </section>
    </div>
  );
}
