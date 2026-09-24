"use client";
import { useState } from "react";
import { SUBJECTS } from "@/lib/study/subjects";
export default function SubjectExplorer() {
  const [q, setQ] = useState("");
  const visible = SUBJECTS.filter((s) =>
    `${s.name} ${s.desc}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="wrap feature-section">
      <input
        className="subject-search"
        aria-label="Search subjects"
        placeholder="Find a subject, concept, or study area..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="feature-grid">
        {visible.map((s, i) => (
          <a
            className="card subject-card"
            key={s.slug}
            href={`/subjects/${s.slug}`}
          >
            <span className="eyebrow">
              STUDY COLLECTION {String(i + 1).padStart(2, "0")}
            </span>
            <h2 style={{ fontSize: 25 }}>{s.name}</h2>
            <p className="small">{s.desc}</p>
            <span className="small">Explore concepts ↗</span>
          </a>
        ))}
      </div>
      {!visible.length && (
        <p>
          No matching subject.{" "}
          <a href={`/dashboard?topic=${encodeURIComponent(q)}`}>
            Create a lesson on “{q}” instead.
          </a>
        </p>
      )}
    </div>
  );
}
