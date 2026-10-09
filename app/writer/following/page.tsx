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
