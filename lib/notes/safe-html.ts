import DOMPurify from "dompurify";
import { renderReadingBody } from "@/lib/pdf/document";

/** Escape at generation, then sanitize again at the browser HTML sink. */
export function renderSafeReadingBody(markdown: string) {
  const html = renderReadingBody(markdown);
  // Server output is built exclusively by the escaping typed renderer.
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
    FORBID_TAGS: [
      "style",
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "foreignObject",
    ],
    FORBID_ATTR: ["srcdoc"],
  });
}
