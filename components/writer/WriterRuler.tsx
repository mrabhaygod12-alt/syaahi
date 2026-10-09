"use client";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
export default function WriterRuler({ editor, disabled, width, onWidth }: {
  editor: Editor | null; disabled: boolean; width: number; onWidth: (width: number) => void;
}) {
  const measure = useRef<HTMLDivElement>(null);
  const [pixels, setPixels] = useState(0), [indent, setIndent] = useState(0), [canIndent, setCanIndent] = useState(false);
  useEffect(() => {
    const node = measure.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setPixels(Math.round(node.clientWidth)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      setCanIndent(editor.isActive("paragraph") || editor.isActive("heading"));
      setIndent(Number(editor.getAttributes(editor.isActive("heading") ? "heading" : "paragraph").indent) || 0);
    };
    update();
    editor.on("selectionUpdate", update).on("transaction", update);
    return () => { editor.off("selectionUpdate", update).off("transaction", update); };
  }, [editor]);
  return (
    <section className="writer-page-ruler" aria-label="Page ruler and paragraph layout">
      <div className="writer-ruler-controls">
        <span className="writer-kicker">PAGE LAYOUT</span>
        <label>Page width
          <select aria-label="Editor page width" value={width} onChange={(e) => onWidth(Number(e.target.value))}>
            <option value={640}>Focused</option><option value={760}>Classic</option><option value={960}>Wide</option>
          </select>
        </label>
        <label>Paragraph indent
          <input aria-label="Paragraph indent" type="range" min={0} max={5} step={1} value={indent} disabled={disabled || !canIndent}
            onChange={(e) => editor?.chain().focus().updateAttributes(editor.isActive("heading") ? "heading" : "paragraph", { indent: Number(e.target.value) }).run()} />
          <output>{indent * 2} em</output>
        </label>
      </div>
      <div className="writer-ruler-measure" ref={measure} style={{ maxWidth: width - 96 }}>
        <div className="writer-ruler-ticks" aria-label={`Text area ${pixels} pixels wide`}>
          {Array.from({ length: 7 }, (_, i) => <span key={i}>{Math.round(pixels * i / 6)}</span>)}
        </div>
        <small>Text width · pixels at this screen size</small>
      </div>
    </section>
  );
}
