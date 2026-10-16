import { isPdfTemplate } from "@/lib/pdf/templates";
import { NOTEBOOK_VERSION } from "./notebook";
export interface NotebookAppearance {
  version: typeof NOTEBOOK_VERSION;
  font: "Caveat" | "Kalam" | "Patrick Hand";
  paper: "cream" | "plain" | "ruled" | "grid";
  template: string;
  seed: string;
}
export class NotebookAppearanceError extends Error {}
export function notebookAppearance(
  value: unknown,
  seed: string,
): NotebookAppearance {
  const b = value as Partial<NotebookAppearance> | null;
  if (
    !b ||
    !["Caveat", "Kalam", "Patrick Hand"].includes(b.font || "") ||
    !["cream", "plain", "ruled", "grid"].includes(b.paper || "") ||
    !isPdfTemplate(b.template)
  )
    throw new NotebookAppearanceError(
      "Choose a supported handwriting, paper and template.",
    );
  return {
    version: NOTEBOOK_VERSION,
    font: b.font!,
    paper: b.paper!,
    template: b.template!,
    seed,
  };
}
