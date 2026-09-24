"use client";
import { useEffect, useState } from "react";
import { useLesson } from "./LessonProvider";

// Select any term in the notes → floating "Ask ✦" button → the slide-over
// chat opens with the selection quoted as the question.
export default function SelectionAsk({
  getScope,
}: {
  getScope: () => HTMLElement | null;
}) {
  const { openChat } = useLesson();
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    const pick = () => {
      // Let the selection settle first (esp. touch).
      setTimeout(() => {
        const s = window.getSelection();
        const el = getScope();
        if (!s || s.isCollapsed || !el || s.rangeCount === 0) {
          setSel(null);
          return;
        }
        const text = s.toString().trim().replace(/\s+/g, " ");
        if (text.length < 3 || text.length > 300) {
          setSel(null);
          return;
        }
        const anchor = s.anchorNode;
        const anchorEl =
          anchor instanceof Element ? anchor : anchor?.parentElement;
        if (!anchorEl || !el.contains(anchorEl)) {
          setSel(null);
          return;
        }
        const r = s.getRangeAt(0).getBoundingClientRect();
        if (!r.width && !r.height) {
          setSel(null);
          return;
        }
        const x = Math.max(
          60,
          Math.min(r.left + r.width / 2, window.innerWidth - 60),
        );
        const below = r.bottom + 10;
        const y =
          below > window.innerHeight - 56 ? Math.max(8, r.top - 52) : below;
        setSel({ text, x, y });
      }, 30);
    };
    const hide = (e: Event) => {
      if ((e.target as HTMLElement)?.closest?.(".sel-ask-btn")) return;
      setSel(null);
    };
    document.addEventListener("mouseup", pick);
    document.addEventListener("touchend", pick);
    document.addEventListener("mousedown", hide);
    document.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mouseup", pick);
      document.removeEventListener("touchend", pick);
      document.removeEventListener("mousedown", hide);
      document.removeEventListener("scroll", hide, true);
    };
  }, [getScope, openChat]);

  if (!sel) return null;
  return (
    <button
      className="sel-ask-btn"
      style={{ left: sel.x, top: sel.y }}
      onClick={() => {
        openChat(`Explain this from my notes: "${sel.text}"`);
        window.getSelection()?.removeAllRanges();
        setSel(null);
      }}
    >
      Ask ✦
    </button>
  );
}
