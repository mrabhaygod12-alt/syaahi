"use client";
import { useEffect, useState } from "react";
import {
  DEFAULT_LEARNING,
  type LearningPreferences,
} from "@/lib/growth/preferences";
import { DEPARTMENTS, STARTER_TOPICS } from "@/lib/growth/samples";
import { SUBJECTS } from "@/lib/study/subjects";
export function PreferenceFields({
  value,
  onChange,
}: {
  value: LearningPreferences;
  onChange: (v: LearningPreferences) => void;
}) {
  const field = (key: keyof LearningPreferences, v: unknown) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="growth-preference-fields">
      <label>
        Study track
        <select
          aria-label="Study track"
          value={value.exam}
          onChange={(e) => field("exam", e.target.value)}
        >
          <option value="university">University / semester exams</option>
          <option value="cbse">CBSE</option>
          <option value="jee">JEE</option>
          <option value="neet">NEET</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Level
        <select
          aria-label="Level"
          value={value.level}
          onChange={(e) => field("level", e.target.value)}
        >
          <option value="ug">Undergraduate (UG)</option>
          <option value="pg">Postgraduate (PG)</option>
        </select>
      </label>
      <label>
        Department
        <select
          aria-label="Department"
          value={value.department}
          onChange={(e) => field("department", e.target.value)}
        >
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      <label>
        Subject
        <select
          aria-label="Subject"
          value={value.subject}
          onChange={(e) => field("subject", e.target.value)}
        >
          {SUBJECTS.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Note language
        <select
          aria-label="Note language"
          value={value.language}
          onChange={(e) => field("language", e.target.value)}
        >
          <option value="english">English</option>
          <option value="hindi">हिंदी</option>
        </select>
      </label>
      <label>
        Daily goal (minutes)
        <input
          type="number"
          min={5}
          max={120}
          value={value.dailyGoal}
          onChange={(e) => field("dailyGoal", Number(e.target.value))}
        />
      </label>
      <label className="growth-checkbox">
        <input
          type="checkbox"
          checked={value.readyNotifications}
          onChange={(e) => field("readyNotifications", e.target.checked)}
        />
        Show lesson-ready updates in my dashboard
      </label>
    </div>
  );
}
export function learningTemplates(p: LearningPreferences): string[] {
  if (p.subject !== "computer-science") return STARTER_TOPICS[p.subject] || [];
  if (p.department === "Data science / AI & ML")
    return p.level === "pg"
      ? [
          "Bias–variance tradeoff and regularization",
          "Transformer attention mechanisms",
          "Bayesian inference: worked example",
          "Evaluation metrics for imbalanced data",
        ]
      : [
          "Linear regression: worked example",
          "Probability for data science",
          "Python data structures",
          "Training and test data leakage",
        ];
  if (p.department === "Cybersecurity")
    return [
      "Network security: threat models",
      "Cryptography: symmetric vs asymmetric",
      "SQL injection prevention",
      "Access control: least privilege",
    ];
  return p.level === "pg"
    ? [
        "Distributed systems: consensus and fault tolerance",
        "Advanced DBMS: serializability",
        "Algorithm analysis: dynamic programming",
        "Operating systems: concurrency and deadlocks",
      ]
    : STARTER_TOPICS["computer-science"];
}
export default function LearningSetup({
  saved,
  onSave,
  onTopic,
  busy,
}: {
  saved?: LearningPreferences;
  onSave: (preferences: LearningPreferences) => Promise<boolean>;
  onTopic: (topic: string, language: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState(saved || DEFAULT_LEARNING),
    [editing, setEditing] = useState(!saved),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (saved) {
      setValue(saved);
      setEditing(false);
    }
  }, [saved?.savedAt]);
  return (
    <section className="hub-panel growth-onboarding">
      <p className="eyebrow">YOUR UNIVERSITY, YOUR PACE</p>
      <h2>
        {saved
          ? `${saved.level.toUpperCase()} · ${saved.department}`
          : "Make your first lesson relevant."}
      </h2>
      <p>
        Choose your department and language. Start with a topic, review its
        outline and confirm the credit cost before generation.
      </p>
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onSave(value)) {
              setEditing(false);
              setMessage("Study preferences saved.");
            }
          }}
        >
          <PreferenceFields value={value} onChange={setValue} />
          <button className="btn dark" disabled={busy}>
            Save study preferences
          </button>
        </form>
      ) : (
        <button className="btn light" onClick={() => setEditing(true)}>
          Edit study preferences
        </button>
      )}
      {message && <p role="status">{message}</p>}
      <div className="growth-suggestions">
        {learningTemplates(saved || value).map((topic) => (
          <button
            key={topic}
            onClick={() => onTopic(topic, (saved || value).language)}
          >
            {topic} →
          </button>
        ))}
      </div>
    </section>
  );
}
