"use client";
import { useRef, useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import type { CatalogModel } from "@/lib/ai/gateway-catalog";
type Setup = {
  type: string;
  label: string;
  status: string;
  keyCount: number;
  credentialLimit: number;
  keyVariable: string;
  modelVariable: string;
  models: string[];
  docs: string;
};
export default function ProviderCatalog({ providers }: { providers: Setup[] }) {
  const [models, setModels] = useState<CatalogModel[]>([]),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [next, setNext] = useState<number | null>(null),
    [total, setTotal] = useState(0);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function inspect(type: string, offset = 0) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setSelected(type);
    if (!offset) {
      setModels([]);
      setNext(null);
    }
    try {
      const { response, data } = await requestJson(
        `/api/admin/providers?provider=${encodeURIComponent(type)}&offset=${offset}`,
        { signal: controller.signal },
        15000,
      );
      if (!response.ok) throw new Error(data.error || "Catalog unavailable.");
      if (controller.signal.aborted) return;
      setModels((old) => (offset ? [...old, ...data.models] : data.models));
      setNext(data.nextOffset);
      setTotal(data.total);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Catalog unavailable.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="admin-panel provider-catalog">
      <h2>Additional model providers</h2>
      <p>
        Server-side configuration only. Inspecting a catalog does not generate
        content or verify inference quality.
      </p>
      <div className="admin-card-grid">
        {providers.map((p) => (
          <article key={p.type} className="admin-panel">
            <h3>{p.label}</h3>
            <span className="admin-status-chip">{p.status}</span>
            <p>
              {p.keyCount}/{p.credentialLimit} credential slots configured
            </p>
            <p>
              <code>{p.keyVariable}</code>
              <br />
              <code>{p.modelVariable}</code>
            </p>
            <p>
              {p.models.length
                ? p.models.join(", ")
                : "No text models selected."}
            </p>
            <button
              type="button"
              className="btn light"
              disabled={busy || !p.keyCount}
              onClick={() => inspect(p.type)}
            >
              Inspect {p.label} models
            </button>{" "}
            <a href={p.docs} target="_blank" rel="noopener noreferrer">
              API docs ↗
            </a>
          </article>
        ))}
      </div>
      <p>
        AntSeedStats provides network analytics. Antseed inference requires your
        configured gateway. Logfare’s regular key is singular; regenerated keys
        replace old ones. Credential slots do not multiply an account’s quota.
        Select fixed non-training models for Logfare; its auto/random aliases
        are excluded.
      </p>
      {busy && <p role="status">Checking model catalog…</p>}
      {error && <p role="alert">{error}</p>}
      {!!models.length && (
        <div
          className="admin-table-wrap"
          aria-label={`${selected} model catalog`}
          role="region"
          tabIndex={0}
        >
          <p>
            {models.length} of {total} models loaded. “Unknown” means the
            gateway did not publish that capability or price.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Model ID</th>
                <th>Output</th>
                <th>Context</th>
                <th>Streaming</th>
                <th>Advertised price</th>
                <th>Account access</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id}>
                  <td>
                    <code>{m.id}</code>
                  </td>
                  <td>{m.kind}</td>
                  <td>
                    {m.contextKnown
                      ? m.context_window.toLocaleString()
                      : "Unknown (8K safety cap)"}
                  </td>
                  <td>
                    {m.streaming === null
                      ? "Unknown"
                      : m.streaming
                        ? "Yes"
                        : "No"}
                  </td>
                  <td>
                    {m.advertisedFree === null
                      ? "Unknown"
                      : m.advertisedFree
                        ? "Free in catalog"
                        : "Usage pricing"}
                  </td>
                  <td>
                    {m.accessible === null
                      ? "Unknown"
                      : m.accessible
                        ? "Listed as available"
                        : "Locked"}
                    {m.trainingConsentRequired && " · Training opt-in required"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {next !== null && (
            <button
              className="btn light"
              type="button"
              disabled={busy}
              onClick={() => inspect(selected, next)}
            >
              Load more models
            </button>
          )}
        </div>
      )}
    </section>
  );
}
