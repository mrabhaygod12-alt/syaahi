import { SITE } from "@/lib/seo";
import type { PublicGuide } from "./public";
const xml = (v: string) =>
  v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function publicationFeed(stories: PublicGuide[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Syaahi reviewed stories</title><link>${xml(SITE.url + "/community")}</link><description>Reviewed articles, guides and perspectives from Syaahi writers.</description><language>en-IN</language><atom:link href="${xml(SITE.url + "/feed.xml")}" rel="self" type="application/rss+xml"/>${stories
    .filter((s) => s.slug && s.publishedAt)
    .slice(0, 80)
    .map((s) => {
      const url = SITE.url + "/guides/" + encodeURIComponent(s.slug!),
        date = new Date(s.publishedAt!);
      return `<item><title>${xml(s.title)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><description>${xml(s.summary.slice(0, 1000))}</description>${Number.isFinite(date.getTime()) ? `<pubDate>${date.toUTCString()}</pubDate>` : ""}<dc:creator>${xml(s.authorName || "Syaahi writer")}</dc:creator><source url="${xml(SITE.url + "/community")}">Syaahi reviewed stories</source></item>`;
    })
    .join("")}</channel></rss>`;
}
