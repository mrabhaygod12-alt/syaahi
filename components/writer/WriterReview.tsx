"use client";
import type { Editor } from "@tiptap/react";
import { documentText, type RichNode } from "@/lib/writing/document";

export function reviewDocument(title: string, document: RichNode) {
  const text = documentText(document).trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  let headings = 0,
    images = 0,
    missingAlt = 0,
    sources = 0,
    longParagraphs = 0;
  const visit = (node: RichNode) => {
    if (node.type === "heading") headings++;
    if (node.type === "image") {
      images++;
      if (!String(node.attrs?.alt || "").trim()) missingAlt++;
    }
    if (
      node.type === "paragraph" &&
      documentText(node).split(/\s+/).filter(Boolean).length > 120
    )
      longParagraphs++;
    sources += (node.marks || []).filter((m) => m.type === "link").length;
    node.content?.forEach(visit);
  };
  visit(document);
  return {
    words,
    characters: text.length,
    headings,
    images,
    sources,
    checks: [
      {
        label: "Publication requirements",
        ok: title.trim().length >= 5 && text.length >= 80,
        detail:
          "Use a title of at least 5 characters and a story of at least 80 characters.",
      },
      {
        label: "Clear section headings",
        ok: words < 400 || headings > 0,
        detail: "Long stories are easier to scan with section headings.",
      },
      {
        label: "Accessible images",
        ok: missingAlt === 0,
        detail: missingAlt
          ? `${missingAlt} image(s) need a description.`
          : `${images} image(s); descriptions present.`,
      },
      {
        label: "Readable paragraphs",
        ok: longParagraphs === 0,
        detail: longParagraphs
          ? `${longParagraphs} paragraph(s) exceed 120 words. Consider splitting them.`
          : "Paragraphs stay within the suggested 120-word reading budget.",
      },
      {
        label: "Linked references",
        ok: sources > 0,
        detail:
          "For factual claims, add links to original evidence. This check does not verify accuracy.",
      },
    ],
  };
}

export default function WriterReview({
  title,
  document,
  editor,
  close,
}: {
  title: string;
  document: RichNode;
  editor: Editor | null;
  close: () => void;
}) {
  const review = reviewDocument(title, document);
  return (
    <aside className="writer-inspector" aria-label="Story review">
      <div className="writer-inspector-heading">
        <div>
          <span className="writer-kicker">BEFORE YOU PUBLISH</span>
          <h2>Story review</h2>
        </div>
        <button aria-label="Close story review" onClick={close}>
          ×
        </button>
      </div>
      <div className="writer-review-counts">
        <span>
          <strong>{review.words}</strong> words
        </span>
        <span>
          <strong>{review.characters}</strong> characters
        </span>
        <span>
          <strong>{review.headings}</strong> headings
        </span>
        <span>
          <strong>{review.images}</strong> images
        </span>
      </div>
      <ul className="writer-review-checks">
        {review.checks.map((check) => (
          <li key={check.label}>
            <span aria-label={check.ok ? "Passed" : "Suggestion"}>
              {check.ok ? "✓" : "○"}
            </span>
            <div>
              <strong>{check.label}</strong>
              <p>{check.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <button
        className="btn light"
        onClick={() => editor?.chain().focus().run()}
      >
        Return to writing
      </button>
      <p className="writer-fine-print">
        These are writing suggestions. Editorial approval and fact-checking
        still happen separately.
      </p>
    </aside>
  );
}
