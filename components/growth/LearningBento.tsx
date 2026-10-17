"use client";
import { useState } from "react";
import {
  Video,
  FileText,
  BrainCircuit,
  BookOpenCheck,
  ArrowUpRight,
  Layers,
  Route,
  MessageCircle,
} from "lucide-react";
import { learningLink } from "@/lib/growth/samples";
import "./learning-bento.css";
const steps = [
  {
    title: "Bring the source",
    description:
      "A university topic, PDF, lecture link or your own notes. Keep the material in view.",
    detail: "01 · SOURCE ROOM",
    Icon: FileText,
  },
  {
    title: "Shape the outline",
    description:
      "See what will be covered. Edit the topics and learning goals before generating.",
    detail: "02 · YOUR PLAN",
    Icon: Route,
  },
  {
    title: "Make ideas visible",
    description:
      "Definitions, examples, diagrams and comparisons form a readable study atlas.",
    detail: "03 · STUDY ATLAS",
    Icon: Layers,
  },
  {
    title: "Recall, then revisit",
    description:
      "Ask a source-aware question, test your understanding and return to the concepts you missed.",
    detail: "04 · ACTIVE RECALL",
    Icon: BookOpenCheck,
  },
];
export default function LearningBento() {
  const [step, setStep] = useState(0),
    [url, setUrl] = useState("");
  const selected = steps[step],
    Icon = selected.Icon;
  return (
    <section
      className="growth-wrap learning-bento"
      id="learning-system"
      aria-labelledby="bento-heading"
    >
      <header data-reveal>
        <p className="growth-eyebrow">LESS SCROLLING. MORE UNDERSTANDING.</p>
        <h2 id="bento-heading">
          Your lecture.
          <br />
          <em>Now a learning system.</em>
        </h2>
        <p>
          Built around how university students actually study: understand the
          source, organise the ideas and practise retrieving them.
        </p>
      </header>
      <div className="learning-bento-grid">
        <article className="bento-lecture" data-reveal>
          <span className="bento-icon">
            <Video aria-hidden="true" />
          </span>
          <p className="growth-eyebrow">WATCH ONCE. REVISIT THE IDEAS.</p>
          <h3>
            A lecture link
            <br />
            becomes your starting point.
          </h3>
          <div className="bento-video-art" aria-hidden="true">
            <span>LECTURE SOURCE</span>
            <div className="bento-wave">
              {Array.from({ length: 23 }, (_, i) => (
                <i key={i} style={{ height: `${18 + ((i * 17) % 45)}px` }} />
              ))}
            </div>
            <div className="bento-source-labels">
              <span>Captions first</span>
              <span>Review the outline</span>
              <span>Saved processing</span>
            </div>
          </div>
          <form action="/dashboard">
            <label htmlFor="lecture-demo">Public YouTube lecture link</label>
            <div>
              <input
                id="lecture-demo"
                type="url"
                name="topic"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                required
                maxLength={2048}
              />
              <button aria-label="Open this lecture in your study workspace">
                <ArrowUpRight size={20} />
              </button>
            </div>
          </form>
          <a href="/youtube-video-to-notes">How video notes work →</a>
        </article>
        <article className="bento-knowledge" data-reveal>
          <BrainCircuit size={28} aria-hidden="true" />
          <h3>See the connections.</h3>
          <p>
            Turn a wall of text into key ideas, process diagrams and a useful
            takeaway.
          </p>
          <div className="bento-mini-map" aria-hidden="true">
            <span>CORE IDEA</span>
            <div>
              <i>Definition</i>
              <i>Example</i>
              <i>Application</i>
            </div>
          </div>
          <a href={learningLink("DBMS normalization with examples")}>
            Try a university topic →
          </a>
        </article>
        <article className="bento-recall" data-reveal>
          <MessageCircle size={28} aria-hidden="true" />
          <h3>Make it stick.</h3>
          <p>
            Notes, source-aware chat, saved quizzes and flashcards belong in the
            same lesson.
          </p>
          <div className="bento-recall-card">
            <span>QUICK CHECK</span>
            <strong>Why normalise a database?</strong>
            <small>
              Explain it in your own words, then compare with the source.
            </small>
          </div>
          <a href="/ai-generated-notes">Explore the study workflow →</a>
        </article>
      </div>
      <div className="bento-workflow" data-reveal>
        <div role="group" aria-label="Explore the study workflow">
          {steps.map((item, i) => (
            <button
              key={item.title}
              aria-pressed={i === step}
              onClick={() => setStep(i)}
            >
              <span>0{i + 1}</span>
              {item.title}
            </button>
          ))}
        </div>
        <article aria-live="polite" key={step}>
          <Icon size={40} aria-hidden="true" />
          <div>
            <small>{selected.detail}</small>
            <h3>{selected.title}</h3>
            <p>{selected.description}</p>
          </div>
        </article>
      </div>
    </section>
  );
}
