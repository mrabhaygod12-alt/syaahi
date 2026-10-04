import { STORY_FONTS } from "./formatting";
export const ARTICLE_THEMES = ["editorial", "journal", "modern"];
export const ARTICLE_PAPERS = ["white", "cream", "sage"];
export const ARTICLE_BORDERS = ["none", "line", "frame"];
export const ARTICLE_SPACING = ["1.5", "1.8", "2"];
export const ARTICLE_ACCENTS = ["#285647", "#945634", "#554889", "#202428"];
export function normalizeDesign(attrs?: Record<string, unknown>) {
  return {
    theme: ARTICLE_THEMES.includes(String(attrs?.theme))
      ? String(attrs!.theme)
      : "editorial",
    articleFont: STORY_FONTS.includes(String(attrs?.articleFont))
      ? String(attrs!.articleFont)
      : "Georgia",
    paragraphSpacing: ARTICLE_SPACING.includes(String(attrs?.paragraphSpacing))
      ? String(attrs!.paragraphSpacing)
      : "1.8",
    paper: ARTICLE_PAPERS.includes(String(attrs?.paper))
      ? String(attrs!.paper)
      : "white",
    pageBorder: ARTICLE_BORDERS.includes(String(attrs?.pageBorder))
      ? String(attrs!.pageBorder)
      : "none",
    accent: ARTICLE_ACCENTS.includes(String(attrs?.accent))
      ? String(attrs!.accent)
      : "#285647",
  };
}
export function articleStyles(
  attrs?: Record<string, unknown>,
): Record<string, string> {
  const d = normalizeDesign(attrs);
  return {
    "--article-font": d.articleFont,
    "--article-spacing": d.paragraphSpacing,
    "--article-accent": d.accent,
    "--article-paper":
      d.paper === "cream"
        ? "#fffaf0"
        : d.paper === "sage"
          ? "#f2f6ed"
          : "#ffffff",
  };
}
export function youtubeId(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    let id = "";
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    else if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
    )
      id =
        url.pathname === "/watch"
          ? url.searchParams.get("v") || ""
          : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1] || "";
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
