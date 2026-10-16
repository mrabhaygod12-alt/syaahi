"use client";
import { useEffect, useRef, useState } from "react";
const steps = [
  {
    label: "Bring a source",
    title: "Your lecture. Your starting point.",
    text: "A topic, PDF or public lecture link. Review what was extracted before continuing.",
  },
  {
    label: "Shape the outline",
    title: "Choose what deserves a page.",
    text: "Check the topics, learning outcomes and credit cost. Make changes before generating.",
  },
  {
    label: "Make your notebook",
    title: "Ideas you can see and explain.",
    text: "Handwritten-style notes, worked examples and a meaningful diagram. Edit and export.",
  },
  {
    label: "Recall the idea",
    title: "A small question. A stronger memory.",
    text: "Practise a saved quiz or flashcard, then return to the explanation you need.",
  },
];
export default function DeviceDemo() {
  const [active, setActive] = useState(0);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect();
        const distance = Math.max(1, box.height - innerHeight);
        setActive(
          Math.min(3, Math.max(0, Math.floor((-box.top / distance) * 4))),
        );
      });
    };
    addEventListener("scroll", update, { passive: true });
    return () => {
      removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <section ref={root} className="device-story" aria-labelledby="device-title">
      <div className="device-story-sticky">
        <div className="device-story-copy">
          <p className="growth-eyebrow">FROM SOURCE TO UNDERSTANDING</p>
          <h2 id="device-title">
            A notebook.
            <br />
            <em>A way forward.</em>
          </h2>
          <p>{steps[active].text}</p>
          <div
            className="device-story-tabs"
            role="group"
            aria-label="Explore the study demonstration"
          >
            {steps.map((s, i) => (
              <button
                key={s.label}
                aria-pressed={active === i}
                onClick={() => setActive(i)}
              >
                <span>0{i + 1}</span>
                {s.label}
              </button>
            ))}
          </div>
          <a href="/#try-preview">Try a short note preview →</a>
        </div>
        <div className="device-laptop">
          <div className="device-screen">
            <div className="device-app-header">
              <b>Syaahii.</b>
              <span>Illustrative product walkthrough</span>
            </div>
            <div className="device-app-body">
              <aside aria-hidden="true">
                ▤<br />✎<br />✓
              </aside>
              <div key={active} className="device-demo-content">
                <small>0{active + 1} / YOUR STUDY FLOW</small>
                <h3>{steps[active].title}</h3>
                {active === 0 ? (
                  <div className="device-source">
                    DBMS lecture.pdf<span>Review the source →</span>
                  </div>
                ) : active === 1 ? (
                  <ol>
                    <li>Understand dependencies</li>
                    <li>Trace a worked example</li>
                    <li>Explain update anomalies</li>
                  </ol>
                ) : active === 2 ? (
                  <div className="device-note">
                    <h4>One fact. One place.</h4>
                    <p>Separate repeated department facts.</p>
                    <div>Student → Department</div>
                    <small>
                      Check: what changes when a department is renamed?
                    </small>
                  </div>
                ) : (
                  <div className="device-question">
                    <span>RECALL CHECK</span>
                    <h4>Why do repeated facts create update anomalies?</h4>
                    <p>Explain it, then check your source.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="device-laptop-base" />
        </div>
      </div>
    </section>
  );
}
