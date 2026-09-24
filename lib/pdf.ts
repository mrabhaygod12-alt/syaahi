"use client";
import type { PrintNote } from "./pdf/document";
export async function downloadPdfFromElement(
  el: HTMLElement,
  filename = "syaahi-notes.pdf",
  onProgress?: (done: number, total: number) => void,
) {
  const nodes = Array.from(
    el.querySelectorAll<HTMLElement>("[data-print-note]"),
  );
  if (!nodes.length) throw new Error("No notes to export.");
  const notes: PrintNote[] = nodes.map((n) => JSON.parse(n.dataset.printNote!));
  onProgress?.(0, notes.length);
  const response = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "PDF export failed.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  onProgress?.(notes.length, notes.length);
}
