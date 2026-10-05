"use client";
import "./note-history.css";
import { useState } from "react";
import { requestJson } from "@/lib/http-client";
export default function NoteHistory({
  lesson,
  section,
  current,
  onRestore,
}: {
  lesson: string;
  section: number;
  current: string;
  onRestore: () => void;
}) {
  const [versions, setVersions] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [revision, setRevision] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const { response, data } = await requestJson(
        `/api/jobs/${lesson}?history=1`,
      );
      if (!response.ok) throw new Error(data.error);
      setRevision(data.revision);
      setVersions(data.history.filter((v: any) => v.section === section));
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="card note-history"
      onToggle={(e) => {
        if (e.currentTarget.open) void load();
      }}
    >
      <summary>Section history · compare and restore</summary>
      {message && <p role="status">{message}</p>}
      {versions.map((v) => (
        <button className="btn light" key={v.id} onClick={() => setSelected(v)}>
          {new Date(v.at).toLocaleString()} · {v.author}
        </button>
      ))}
      {!versions.length && (
        <p>Previous text is saved when this section is edited.</p>
      )}
      {selected && (
        <>
          <div className="note-compare">
            <section>
              <h4>Current text</h4>
              <pre>{current}</pre>
            </section>
            <section>
              <h4>Previous text</h4>
              <pre>{selected.markdown}</pre>
            </section>
          </div>
          <button
            className="btn dark"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { response, data } = await requestJson(
                  `/api/jobs/${lesson}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "restore-page",
                      version: selected.id,
                      revision,
                    }),
                  },
                );
                if (!response.ok) throw new Error(data.error);
                onRestore();
                setSelected(null);
                setMessage(
                  "Restored. Regenerate practice for the revised notes.",
                );
                await load();
              } catch (e) {
                setMessage(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Restore this text
          </button>
        </>
      )}
    </details>
  );
}
