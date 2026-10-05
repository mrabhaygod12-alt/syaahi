import paths from "./icon-paths.json";
import type { SceneElement } from "./scene";
import type { SlideIcon } from "./archetypes";
/** Fixed, licensed SVG assets; user/model text never enters SVG markup. */
export function iconSvg(icon: SlideIcon, color: string) {
  return paths[icon].replace('stroke="currentColor"', `stroke="#${color}"`);
}
export function artworkHtml(elements: SceneElement[]) {
  return elements
    .filter((p) => p.type !== "text")
    .map(
      (p) =>
        `<div aria-hidden="true" style="position:absolute;left:${p.x / 12.8}%;top:${p.y / 7.2}%;width:${p.w / 12.8}%;height:${p.h / 7.2}%;${p.type === "surface" ? `background:#${p.color};border:1px solid #${p.stroke};border-radius:${p.radius / 12.8}cqw` : ""}">${p.type === "icon" ? iconSvg(p.icon, p.color) : ""}</div>`,
    )
    .join("");
}
