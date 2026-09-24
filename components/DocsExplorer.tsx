"use client";
import { useState } from "react";
const guides = [
  [
    "getting-started",
    "Getting started",
    "Your account, first outline, and study workspace.",
  ],
  [
    "generating-notes",
    "Generate thoughtful notes",
    "Source labels, page targets, credits, and recovery.",
  ],
  [
    "youtube",
    "Learn from lectures",
    "Caption availability, transcript review, and alternatives.",
  ],
  [
    "syllabus-pdf",
    "Documents & screenshots",
    "PDF extraction, image reading, and audio uploads.",
  ],
  [
    "handwriting-styles",
    "Layout & PDF export",
    "Handwriting, paper, templates, and continuation sheets.",
  ],
  [
    "credits-billing",
    "Credits & billing",
    "Reservations, captured payments, and refunds.",
  ],
  [
    "api",
    "Application API",
    "Authentication, lesson endpoints, and deployment.",
  ],
];
export default function DocsExplorer() {
  const [q, setQ] = useState("");
  return (
    <div className="wrap feature-section">
      <input
        type="text"
        className="subject-search"
        aria-label="Search documentation"
        placeholder="What do you need help with?"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="feature-grid">
        {guides
          .filter((g) => g.join(" ").toLowerCase().includes(q.toLowerCase()))
          .map(([slug, t, d]) => (
            <a className="card subject-card" key={slug} href={`/docs/${slug}`}>
              <h2 style={{ fontSize: 24 }}>{t}</h2>
              <p className="small">{d}</p>
              <span className="small">Read guide →</span>
            </a>
          ))}
      </div>
    </div>
  );
}
