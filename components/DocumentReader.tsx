"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
export default function DocumentReader({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    [error, setError] = useState("");
  const [document, setDocument] = useState<{
    name: string;
    pageCount: number;
    text: string;
  } | null>(null);
  useEffect(() => {
    const requested = Number(new URLSearchParams(location.search).get("page"));
    if (Number.isInteger(requested) && requested > 0 && requested <= 500)
      setPage(requested);
  }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setDocument(null);
    requestJson(`/api/documents/${encodeURIComponent(id)}?page=${page}`, {
      signal: controller.signal,
    })
      .then(({ response, data }) => {
        if (!response.ok)
          throw new Error(data.error || "Document unavailable.");
        if (!controller.signal.aborted) setDocument(data as any);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [id, page]);
  return (
    <section className="wrap feature-section">
      <a href="/dashboard">← Workspace</a>
      <h1>{document?.name || "Private textbook"}</h1>
      <p>
        Page numbers refer to physical PDF pages. Extraction can differ from the
        original layout.
      </p>
      <label>
        PDF page{" "}
        <input
          type="number"
          min={1}
          max={document?.pageCount || 500}
          value={page}
          onChange={(e) =>
            setPage(Math.max(1, Math.min(500, Number(e.target.value) || 1)))
          }
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {document ? (
        <div className="card" style={{ whiteSpace: "pre-wrap", marginTop: 20 }}>
          {document.text || "No readable text on this page."}
        </div>
      ) : (
        !error && <p role="status">Loading page…</p>
      )}
    </section>
  );
}
