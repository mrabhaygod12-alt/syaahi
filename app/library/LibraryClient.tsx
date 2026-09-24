"use client";
import { useEffect, useState } from "react";
interface Pack {
  slug: string;
  title: string;
  category: string;
  pages: number;
  updatedAt?: string;
}

export default function LibraryClient() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((j) => setPacks(j.packs ?? []));
  }, []);

  return (
    <>
      <div className="grid grid-4" style={{ marginTop: 16 }}>
        {packs.map((p) => (
          <div key={p.slug} className="card">
            <div className="small">
              {p.category} · {p.pages} pages
            </div>
            <h3>
              <a href={`/library/${p.slug}`}>{p.title}</a>
            </h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn light"
                onClick={() =>
                  fetch(`/api/library?slug=${p.slug}`)
                    .then((r) => r.json())
                    .then(setPreview)
                }
              >
                Quick preview
              </button>
              <a className="btn dark" href={`/library/${p.slug}`}>
                Open pack
              </a>
            </div>
          </div>
        ))}
        {!packs.length && (
          <div
            className="card"
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "40px 24px",
            }}
          >
            <b>Curated examples are on their way.</b>
            <p className="small">
              Create your own private lesson in the meantime. It will stay in
              your account.
            </p>
            <a className="btn dark" href="/dashboard">
              Create a private lesson
            </a>
          </div>
        )}
      </div>
      {preview && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>
            {preview.title}{" "}
            <span className="small">
              free preview · page 1 of {preview.pages}
            </span>
          </h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "'Caveat', cursive",
              fontSize: 22,
              color: "#1a2a6b",
            }}
          >
            {preview.preview}
          </pre>
          <p className="small">{preview.note}</p>
          <a
            className="btn dark"
            href={`/dashboard?topic=${encodeURIComponent(preview.title)}`}
          >
            Create notes on this topic
          </a>
        </div>
      )}
    </>
  );
}
