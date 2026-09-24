"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderDocument } from "@/lib/pdf/document";
import type { StyleOpts } from "@/lib/handwriting/options";
let cachedAssets: Promise<{ fonts: string; math: string }> | undefined;
export default function NotePage({
  markdown,
  style,
  footer,
  seedKey = "page",
  template = "classic",
}: {
  markdown: string;
  style: StyleOpts;
  footer: string;
  seedKey?: string;
  template?: "classic" | "poster" | "lab" | "magazine";
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1123);
  const [assets, setAssets] = useState<{ fonts: string; math: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    if (!cachedAssets)
      cachedAssets = fetch("/api/print-assets").then((r) => {
        if (!r.ok) throw new Error("Fonts unavailable");
        return r.json();
      });
    cachedAssets
      .then((a) => {
        if (alive) setAssets(a);
      })
      .catch(() => {
        cachedAssets = undefined;
        if (alive) setError("Unable to load print fonts. Refresh to retry.");
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.type !== "syaahi-layout"
      )
        return;
      const h = Number(event.data.height);
      if (Number.isFinite(h) && h > 0 && h < 100000) setHeight(h);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  const html = useMemo(
    () =>
      assets
        ? renderDocument(
            [{ markdown, style, footer, template }],
            assets.fonts,
            assets.math,
          )
        : "",
    [markdown, style, footer, template, assets],
  );
  return (
    <div
      className="print-note"
      data-print-note={JSON.stringify({ markdown, style, footer, template })}
      data-seed={seedKey}
    >
      {error ? (
        <p role="alert">{error}</p>
      ) : !assets ? (
        <p className="small">Preparing print layout...</p>
      ) : (
        <iframe
          ref={frame}
          title={footer || "Handwritten note preview"}
          srcDoc={html}
          sandbox="allow-scripts"
          style={{ border: 0, width: "100%", height, display: "block" }}
        />
      )}
    </div>
  );
}
