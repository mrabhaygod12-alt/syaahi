"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const stages = [
  [
    "01",
    "Capture",
    "Start with a topic, document, image, recording or supported lecture.",
  ],
  [
    "02",
    "Shape",
    "Review the outline, sources and learning goal before a lesson is created.",
  ],
  [
    "03",
    "Recall",
    "Use explanations, quizzes and flashcards to find what needs another pass.",
  ],
  [
    "04",
    "Keep",
    "Return to the lesson, export notes, or share access when you choose.",
  ],
] as const;

export default function FeatureJourney() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.from("[data-journey-heading]", {
          opacity: 0,
          y: 20,
          duration: 0.55,
          ease: "power2.out",
          scrollTrigger: {
            trigger: root.current,
            start: "top 82%",
            once: true,
          },
        });
        gsap.from("[data-journey-card]", {
          opacity: 0,
          y: 24,
          scale: 0.98,
          stagger: 0.1,
          duration: 0.58,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".feature-journey-grid",
            start: "top 84%",
            once: true,
          },
        });
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);

  return (
    <section
      ref={root}
      className="wrap feature-journey"
      aria-labelledby="study-journey-title"
    >
      <div className="feature-journey-intro" data-journey-heading>
        <p className="eyebrow">ONE CONNECTED STUDY LOOP</p>
        <h2 id="study-journey-title">
          Every tool knows where your learning started.
        </h2>
        <p>
          Syaahi keeps the source, generated lesson and practice tools
          connected, so you can move from a difficult idea to a useful review
          session without losing context.
        </p>
      </div>
      <div className="feature-journey-grid">
        {stages.map(([number, title, copy]) => (
          <article data-journey-card key={title}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
      <a className="journey-link" href="/how-it-works">
        See the full study workflow <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}
