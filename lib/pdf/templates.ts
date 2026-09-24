export const PDF_TEMPLATES = [
  {
    id: "classic",
    label: "Classic notebook",
    blurb: "Ruled feel, gold title highlight, topper callouts.",
  },
  {
    id: "poster",
    label: "Poster study",
    blurb: "Navy banner, big section chips, poster-style diagrams.",
  },
  {
    id: "lab",
    label: "Lab worksheet",
    blurb: "Teal grid header, experiment-style steps and term cards.",
  },
  {
    id: "magazine",
    label: "Magazine spread",
    blurb: "Editorial serif titles, pull-quotes, two-tone tables.",
  },
] as const;

export type PdfTemplateId = (typeof PDF_TEMPLATES)[number]["id"];

export function isPdfTemplate(v: unknown): v is PdfTemplateId {
  return PDF_TEMPLATES.some((t) => t.id === v);
}
