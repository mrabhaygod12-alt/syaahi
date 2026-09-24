"use client";
import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
const steps = [
  {
    title: "Bring your starting point",
    body: "Add a topic, screenshot, PDF, audio file, or YouTube link. You can inspect and correct extracted text before the AI uses it.",
    sample: [
      "Topic → Cyber forensics",
      "Screenshot → Extract visible text",
      "Lecture → Read available captions",
    ],
  },
  {
    title: "Choose the shape of your notes",
    body: "Set a page target, language, and depth. Review the outline and sources. Edit or remove sections before any credits are reserved.",
    sample: [
      "1. Evidence collection",
      "2. Chain of custody",
      "3. Disk imaging and integrity",
    ],
  },
  {
    title: "Understand, then test yourself",
    body: "Each lesson keeps notes, original material, source-grounded chat, quizzes, and flashcards in one workspace. Ask follow-up questions when a concept is unclear.",
    sample: [
      "Read a worked example",
      "Explain it without looking",
      "Use a quiz to find a knowledge gap",
    ],
  },
  {
    title: "Take your notes with you",
    body: "Export a selectable-text A4 PDF. Content flows onto continuation sheets instead of being squeezed into a page. Extra continuation sheets use no additional credits.",
    sample: [
      "Readable handwriting",
      "Preserved code indentation",
      "Consistent preview and PDF layout",
    ],
  },
];
export default function Walkthrough() {
  const panel = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(".step-art .card", {
        opacity: 0,
        x: 30,
        stagger: 0.14,
        duration: 0.55,
        ease: "power2.out",
      });
      gsap.from(".steps-grid h2,.steps-grid p:not(.card)", {
        opacity: 0,
        y: 12,
        stagger: 0.08,
        duration: 0.45,
      });
    }, panel);
    return () => ctx.revert();
  }, [step]);
  return (
    <div ref={panel} className="wrap feature-section">
      <div className="tabs-row" role="tablist" aria-label="Study workflow">
        {steps.map((s, i) => (
          <button
            role="tab"
            id={`step-${i}`}
            aria-controls="step-panel"
            aria-selected={step === i}
            key={s.title}
            onClick={() => setStep(i)}
          >
            {String(i + 1).padStart(2, "0")}{" "}
            {["Bring", "Plan", "Practise", "Keep"][i]}
          </button>
        ))}
      </div>
      <div
        className="interactive-panel steps-grid"
        id="step-panel"
        role="tabpanel"
        aria-labelledby={`step-${step}`}
      >
        <div>
          <span className="eyebrow">STEP {step + 1} OF 4</span>
          <h2>{steps[step].title}</h2>
          <p>{steps[step].body}</p>
          <button className="btn light" onClick={() => setStep((step + 1) % 4)}>
            Explore next step →
          </button>
        </div>
        <div className="step-art">
          <span className="eyebrow">ILLUSTRATIVE WORKFLOW</span>
          {steps[step].sample.map((s, i) => (
            <p className="card" key={s}>
              {i + 1}. {s}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
