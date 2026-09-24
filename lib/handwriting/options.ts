// Handwriting style catalogue — all fonts are free Google Fonts (OFL).
export const FONTS = [
  {
    id: "Caveat",
    label: "Caveat (natural, default)",
    family: "'Caveat', cursive",
  },
  { id: "Kalam", label: "Kalam (neat school)", family: "'Kalam', cursive" },
  {
    id: "Patrick Hand",
    label: "Patrick Hand (print)",
    family: "'Patrick Hand', cursive",
  },
  {
    id: "Shadows Into Light",
    label: "Shadows Into Light (tall)",
    family: "'Shadows Into Light', cursive",
  },
  {
    id: "Indie Flower",
    label: "Indie Flower (round)",
    family: "'Indie Flower', cursive",
  },
  {
    id: "Gochi Hand",
    label: "Gochi Hand (marker)",
    family: "'Gochi Hand', cursive",
  },
] as const;

export const INKS = [
  { id: "#1a2a6b", label: "Ballpoint blue" },
  { id: "#111111", label: "Black gel" },
  { id: "#c0272d", label: "Red pen" },
  { id: "#555555", label: "Pencil grey" },
  { id: "#1a6b3c", label: "Green pen" },
] as const;

export const PAPERS = [
  { id: "ruled", label: "Ruled notebook" },
  { id: "plain", label: "Plain white" },
  { id: "grid", label: "Grid / graph" },
  { id: "cream", label: "Cream exam sheet" },
] as const;

export type PaperId = (typeof PAPERS)[number]["id"];

export interface StyleOpts {
  font: string;
  ink: string;
  paper: PaperId;
  size: number;
  jitter: number;
}

export const DEFAULT_STYLE: StyleOpts = {
  font: "Caveat",
  ink: "#1a2a6b",
  paper: "ruled",
  size: 24,
  jitter: 0,
};
