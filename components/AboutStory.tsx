"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-story]").forEach((el) =>
          gsap.from(el, {
            y: 28,
            opacity: 0,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          }),
        );
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);
  return (
    <div ref={root} className="wrap about-page">
      <section className="about-hero">
        <div>
          <p className="eyebrow">ABOUT THE CREATORS</p>
          <h1>
            Built with curiosity.
            <br />
            <em>Grounded in care.</em>
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
            I’m Manish Kumar Singh, DevOps Engineer &amp; Academic Researcher at Syaahi.
            I focus on architecting resilient cloud infrastructure, container
            orchestration, and researching high-retention learning workflows.
          </p>
          <p className="about-lead">
            Working alongside Chandan Pandey, my goal is ensuring Syaahi’s study engine
            runs with zero downtime, instant rendering speeds, and rock-solid reliability.
          </p>
          <div className="about-tags">
            <span>DevOps Engineer</span>
            <span>Cloud Infrastructure</span>
            <span>Academic Researcher</span>
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
        <h2>Scalable infrastructure for uninterrupted student success.</h2>
        <p>
          When students are preparing for semester finals or competitive board exams,
          every second of focus matters. Downtime or slow note compilation during critical
          revision periods is unacceptable.
        </p>
        <p>
          I design and monitor Syaahi’s infrastructure with a defense-in-depth approach:
          from automated Docker deployments on Render and Vercel frontend delivery and edge routing,
          to resilient connection pooling with MongoDB Atlas and automated health probes.
        </p>
        <p>
          Alongside infrastructure engineering, I lead academic research on memory encoding,
          analyzing how handwritten visual anchors and active recall cycles improve long-term
          retention across CBSE, ICSE, and University syllabi.
        </p>
        <div className="about-socials">
          <span className="btn light" style={{ cursor: "default", fontWeight: 700 }}>
            ⚡ Infrastructure &amp; DevOps
          </span>
          <span className="btn light" style={{ cursor: "default", fontWeight: 700 }}>
            🧠 Cognitive Science Research
          </span>
          <a
            className="btn dark"
            href="/support"
          >
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
