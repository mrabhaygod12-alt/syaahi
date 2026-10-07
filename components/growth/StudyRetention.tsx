"use client";
import { useState } from "react";
import type { hubView } from "@/lib/study/hub";
type Hub = Awaited<ReturnType<typeof hubView>>;
export default function StudyRetention({
  hub,
  change,
  busy,
}: {
  hub: Hub;
  change: (b: unknown) => Promise<boolean>;
  busy: boolean;
}) {
  const [minutes, setMinutes] = useState(hub.retention.minutes);
  const r = hub.retention,
    goal = hub.state.preferences?.dailyGoal || 15;
  return (
    <section className="hub-panel growth-retention">
      <div>
        <p className="eyebrow">SMALL STEPS COUNT</p>
        <h2>
          {r.nextExam
            ? `${r.nextExam.days} days to ${r.nextExam.name}`
            : "Build a steady revision routine."}
        </h2>
        <p>
          {r.nextExam
            ? `${r.nextExam.remaining} revision tasks remaining. `
            : "Set a date in Exam planner to see your countdown. "}
          {r.quizAccuracy === null
            ? "Take a quiz to see your accuracy."
            : `${r.quizAccuracy}% accuracy across your latest saved attempts.`}
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void change({ action: "daily-minutes", minutes });
        }}
      >
        <label>
          Today's study minutes (self-reported)
          <input
            type="number"
            min={0}
            max={480}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <progress
          value={Math.min(r.minutes, goal)}
          max={goal}
          aria-label="Daily study goal"
        />
        <small>
          {r.minutes} / {goal} minutes · no pressure to keep a streak
        </small>
        <button className="btn light" disabled={busy}>
          Save today's total
        </button>
      </form>
      {hub.notifications.length > 0 && (
        <div className="growth-ready">
          <h3>Your lessons are ready</h3>
          {hub.notifications.map((n) => (
            <div key={n.id}>
              <a href={`/lesson/${n.id}/notes`}>{n.title} ↗</a>
              <button
                disabled={busy}
                onClick={() =>
                  void change({ action: "notification-read", id: n.id })
                }
                aria-label={`Dismiss ready update for ${n.title}`}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
