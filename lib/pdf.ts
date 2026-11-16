"use client";
import type { PrintNote } from "./pdf/document";

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function errorMessage(response: Response) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json"))
    return response.status === 401 || response.status === 403
      ? "Your session expired. Sign in again, then retry the PDF download."
      : `PDF export is temporarily unavailable (${response.status}). Try again or use Print / Save as PDF.`;
  const data = await response.json().catch(() => ({}));
  return typeof data.error === "string"
    ? data.error
    : "PDF export failed. Try again or use Print / Save as PDF.";
}

export async function downloadPdfFromElement(
  el: HTMLElement,
  filename = "syaahi-notes.pdf",
  onProgress?: (done: number, total: number) => void,
  appendix?: PrintNote,
) {
  const nodes = Array.from(
    el.querySelectorAll<HTMLElement>("[data-print-note]"),
  );
  if (!nodes.length) throw new Error("No notes to export.");
  const notes: PrintNote[] = nodes.map((n) => JSON.parse(n.dataset.printNote!));
  if (appendix) notes.push(appendix);
  onProgress?.(0, notes.length);
  let response: Response | undefined;
  let networkFailure = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
        cache: "no-store",
      });
      if (![502, 503, 504].includes(response.status) || attempt > 0) break;
      const retryAfter = Number(response.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0)
        await wait(Math.min(3000, Math.max(700, retryAfter * 1000)));
    } catch (error) {
      networkFailure = true;
      if (
        attempt > 0 ||
        (error instanceof DOMException && error.name === "AbortError")
      )
        throw new Error(
          "The PDF service could not be reached. Use Print / Save as PDF below, then retry the direct download later.",
        );
    }
    await wait(700);
  }
  if (!response)
    throw new Error(
      networkFailure
        ? "The PDF service could not be reached. Use Print / Save as PDF below, then retry the direct download later."
        : "PDF export failed. Try again or use Print / Save as PDF.",
    );
  if (!response.ok) throw new Error(await errorMessage(response));
  const blob = await response.blob();
  if (
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/pdf") ||
    blob.size < 5 ||
    new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer()) !== "%PDF-"
  )
    throw new Error(
      "The PDF service returned an invalid file. Use Print / Save as PDF below, then retry the direct download later.",
    );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  onProgress?.(notes.length, notes.length);
}
