export const PDF_TEMPLATES = [
  {
    id: "sketchnote",
    label: "Pastel sketchnotes",
    blurb:
      "Handwritten explanations, soft marker highlights and pen-drawn concept diagrams.",
  },
  {
    id: "bluepen",
    label: "Blue-pen notebook",
    blurb: "Ruled paper, blue ink and carefully worked examples.",
  },
  {
    id: "cornell",
    label: "Cornell revision",
    blurb: "Recall margin, focused explanations and a revision summary.",
  },
  {
    id: "atlas",
    label: "Illustrated study atlas",
    blurb:
      "Pastel concept cards, numbered sections, clear process diagrams and highlighted takeaways.",
  },
  {
    id: "study",
    label: "Study notebook",
    blurb:
      "Blue handwriting, maroon underlined headings and boxed flowcharts: inspired by the Algorithms reference.",
  },
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
  {
    id: "exam",
    label: "Exam revision",
    blurb:
      "Ruled paper, highlighter marks and generous margins for last-minute revision.",
  },
  {
    id: "annotated",
    label: "Annotated notebook",
    blurb:
      "Margin-note prompts, warm paper and visual emphasis for deeper review.",
  },
] as const;

export const NOTEBOOK_TEMPLATES = PDF_TEMPLATES.slice(0, 3);

export type PdfTemplateId = (typeof PDF_TEMPLATES)[number]["id"];

export function isPdfTemplate(v: unknown): v is PdfTemplateId {
  return PDF_TEMPLATES.some((t) => t.id === v);
}
