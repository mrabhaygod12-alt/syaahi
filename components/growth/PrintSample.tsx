"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { DEFAULT_STYLE } from "@/lib/handwriting/options";
const NotePage = dynamic(() => import("@/components/NotePage"), {
  loading: () => <p role="status">Loading handwriting renderer…</p>,
});
export default function PrintSample({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card">
      <button
        className="btn light"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? "Close print preview" : "Open handwritten print preview"}
      </button>
      {open && (
        <NotePage
          markdown={markdown}
          style={{ ...DEFAULT_STYLE, paper: "cream" }}
          footer="Original university sample"
        />
      )}
    </section>
  );
}
