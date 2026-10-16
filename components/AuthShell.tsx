import type { ReactNode } from "react";
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-stage">
      <aside className="auth-story" aria-label="Your study space">
        <p className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</p>
        <h2>
          Make room
          <br />
          for your next
          <br />
          <em>good idea.</em>
        </h2>
        <div className="auth-note" aria-label="Illustrative notebook sample">
          <span>ONE FACT. ONE PLACE.</span>
          <h3>
            Understand it.
            <br />
            Make it yours.
          </h3>
          <p>
            Read the source → connect the ideas → explain it in your own words.
          </p>
          <small>Illustrative study workflow</small>
        </div>
        <p>Notes, meaningful practice and a space for your words.</p>
      </aside>
      <section className="auth-stage-form">{children}</section>
    </div>
  );
}
