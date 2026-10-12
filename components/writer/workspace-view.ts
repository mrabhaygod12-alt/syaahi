export type WriterView = {
  layout: "paper" | "web";
  ruler: boolean;
  grid: boolean;
  navigation: boolean;
  zoom: number;
  spellcheck: boolean;
};
export const DEFAULT_WRITER_VIEW: WriterView = {
  layout: "paper",
  ruler: true,
  grid: false,
  navigation: false,
  zoom: 100,
  spellcheck: true,
};
