"use client";
// Build the private child tree in the same client boundary as its account gate,
// as the profile/library/stories workspaces do. Do not stream server children
// into a gate that can open while those children are still hydrating.
import WriterShell from "@/components/writer/WriterShell";
import ConnectionsPanel from "@/components/writer/ConnectionsPanel";
import "@/components/writer/social-workspace.css";
export default function Page() {
  return (
    <WriterShell>
      <section className="writer-primary writer-connections-page">
        <p className="writer-kicker">VOICES WORTH YOUR TIME</p>
        <h1>Your connections</h1>
        <p>Build your reading circle, one thoughtful writer at a time.</p>
        <ConnectionsPanel />
      </section>
    </WriterShell>
  );
}
