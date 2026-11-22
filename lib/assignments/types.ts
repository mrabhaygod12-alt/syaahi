export const ASSIGNMENT_CREDITS = 8;
export const MAX_ASSIGNMENT_PAGES = 40;

export const ASSIGNMENT_FORMATS = [
  "Essay",
  "Research paper",
  "Comparative analysis",
  "Case study",
  "Lab report",
  "Literature review",
  "Project report",
  "Reflective journal",
] as const;

export type AssignmentFormat = (typeof ASSIGNMENT_FORMATS)[number];
export type AssignmentPaper = "ruled" | "plain";
export type CitationStyle = "APA 7" | "IEEE" | "MLA 9" | "Harvard";

export interface AssignmentSource {
  doi: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string;
  url: string;
  abstract: string;
  indexedBy: Array<"Crossref" | "OpenAlex">;
}

export interface AssignmentSection {
  heading: string;
  markdown: string;
  provider: string;
  model: string;
  visual?: AssignmentVisual;
  visualProvider?: string;
  visualModel?: string;
  structureChecked?: boolean;
  wordCount?: number;
}

export interface AssignmentVisual {
  kind: "flow" | "cycle" | "layers" | "decision" | "concept";
  title: string;
  labels: string[];
}

export interface Assignment {
  id: string;
  user: string;
  title: string;
  course: string;
  topic: string;
  instructions: string;
  format: AssignmentFormat;
  pageCount: number;
  paper: AssignmentPaper;
  font: "Kalam" | "Caveat" | "Patrick Hand";
  citationStyle: CitationStyle;
  sources: AssignmentSource[];
  phase: "outline" | "draft";
  status: "queued" | "working" | "outline" | "ready" | "error";
  progress: number;
  outline: string[];
  sections: AssignmentSection[];
  revisionCount: number;
  attemptCount: number;
  error: string | null;
  chargedCredits: number;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export const ASSIGNMENT_FORMAT_GUIDANCE: Record<AssignmentFormat, string> = {
  Essay:
    "A focused thesis, introduction, logically ordered argument, evidence-led body, counterpoint where useful, and conclusion.",
  "Research paper":
    "A question and scope, brief literature context, method or approach, evidence and analysis, limitations, conclusion, and references.",
  "Comparative analysis":
    "A clear comparison question, shared criteria, balanced treatment of each side, a synthesis of meaningful differences, and a conclusion.",
  "Case study":
    "Context and case boundaries, key issue, evidence, analytical framework, findings, practical recommendations, and limitations.",
  "Lab report":
    "Aim, hypothesis, method, observations or results, analysis, limitations, conclusion, and references. Do not invent measurements.",
  "Literature review":
    "A defined scope, themes across sources, agreements and disagreements, quality/coverage limits, gaps, and synthesis.",
  "Project report":
    "Objectives, requirements, approach, implementation or plan, evaluation criteria, risks, outcomes, and next steps.",
  "Reflective journal":
    "A specific experience, considered reflection, connection to course ideas, learning, and a practical next step. Personal details remain prompts for the student to supply.",
};

export function validAssignmentFormat(
  value: unknown,
): value is AssignmentFormat {
  return (
    typeof value === "string" &&
    (ASSIGNMENT_FORMATS as readonly string[]).includes(value)
  );
}

export function validCitationStyle(value: unknown): value is CitationStyle {
  return (
    value === "APA 7" ||
    value === "IEEE" ||
    value === "MLA 9" ||
    value === "Harvard"
  );
}
