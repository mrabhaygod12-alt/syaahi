import type { SlideManifest } from "./model";
export const xml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function randomSeed(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(1664525, n) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
export function visualNodes(s: SlideManifest) {
  const count = Math.max(3, Math.min(12, Math.round(4 + s.visual.density * 8))),
    rand = randomSeed(s.visual.seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2,
      r = s.visual.exploded ? 185 : 140;
    return {
      x:
        s.metaphor === "timeline"
          ? 55 + (i / (count - 1)) * 390
          : 250 + Math.cos(angle) * r,
      y:
        s.metaphor === "timeline"
          ? 240 + (i % 2 ? 30 : -30)
          : 250 + Math.sin(angle) * r,
      z: (rand() - 0.5) * 1.8,
      r: i === 0 ? 24 : 9 + rand() * 10,
      fact: i % s.facts.length,
    };
  });
}
/** Pure, deterministic vector fallback also used by PDF, PPTX and video. */
export function visualSvg(s: SlideManifest, time = 0) {
  const nodes = visualNodes(s),
    a = xml(s.genome.accent),
    b = xml(s.genome.secondary);
  const links = nodes
    .map((p, i) => {
      const q = nodes[(i + 1) % nodes.length];
      return `<path d="M${p.x} ${p.y} Q250 ${230 + Math.sin(i + time) * 35} ${q.x} ${q.y}" fill="none" stroke="${b}" stroke-width="1.4" opacity=".4"/>`;
    })
    .join("");
  const rings = [100, 160, 210]
    .map(
      (r, i) =>
        `<ellipse cx="250" cy="250" rx="${r}" ry="${r * 0.52}" transform="rotate(${i * 47 + time * 3} 250 250)" fill="none" stroke="${a}" stroke-width="1" opacity=".22"/>`,
    )
    .join("");
  const points = nodes
    .map(
      (p, i) =>
        `<g data-node="${i}"><circle cx="${p.x}" cy="${p.y}" r="${p.r + 6}" fill="${a}" opacity=".08"/><circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${i % 2 ? a : b}" opacity=".85"/><circle cx="${p.x - p.r * 0.25}" cy="${p.y - p.r * 0.25}" r="${p.r * 0.25}" fill="white" opacity=".5"/></g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" role="img" aria-label="Conceptual ${xml(s.metaphor)} illustration">${rings}${links}${points}</svg>`;
}
export const VERTEX_SHADER = `attribute vec2 position;varying vec2 vUv;void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
export const FRAGMENT_SHADER = `precision mediump float;varying vec2 vUv;uniform float u_time;uniform float u_audioBeat;uniform float u_wordEmphasis;uniform vec3 u_accent;void main(){vec2 p=(vUv-.5)*2.;float d=length(p);float wave=sin(d*20.-u_time*1.8+sin(p.x*5.+u_time))*0.5+0.5;float band=pow(wave,10.)*smoothstep(1.3,.1,d);float pulse=1.+u_audioBeat*.3+u_wordEmphasis*.12;gl_FragColor=vec4(u_accent,band*.45*pulse);}`;
export function manifestHtml(s: SlideManifest, index = 0, logo = "") {
  const g = s.genome;
  return `<article class="hybrid-frame" style="background:${g.canvas};color:${g.ink};font-family:'${g.font}',Arial,sans-serif">${logo ? `<img alt="Presentation brand logo" src="${logo}" style="position:absolute;right:5%;top:4%;width:4.7%;height:8%;object-fit:contain">` : ""}<div class="hybrid-copy"><span class="hybrid-category">${xml(s.category)}</span><h1 data-fit>${xml(s.headline)}</h1><div class="hybrid-facts">${s.facts.map((f, i) => `<p data-fit><span>${String(i + 1).padStart(2, "0")}</span>${xml(f.statement)}<sup>[${i + 1}]</sup></p>`).join("")}</div></div><div class="hybrid-art">${visualSvg(s)}</div><footer><span>${s.facts.map((f, i) => `[${i + 1}] ${xml(f.documentTitle.slice(0, 50))}${f.pageNumber ? ` · p. ${f.pageNumber}` : ""}`).join(" &nbsp; ")}</span><b>${String(index + 1).padStart(2, "0")}</b></footer></article>`;
}
export const FRAME_CSS = `*{box-sizing:border-box}.hybrid-frame{position:relative;width:1280px;height:720px;overflow:hidden;padding:64px}.hybrid-copy{position:relative;width:550px;z-index:2}.hybrid-category{font-size:13px;letter-spacing:.18em;font-weight:600}.hybrid-frame h1{font-size:48px;line-height:1.08;letter-spacing:-.035em;margin:30px 0 35px;max-height:170px;overflow:hidden}.hybrid-facts{display:grid;gap:18px}.hybrid-facts p{position:relative;font-size:20px;line-height:1.5;padding-left:35px;margin:0;max-height:100px;overflow:hidden}.hybrid-facts p>span{position:absolute;left:0;top:4px;font-size:10px;opacity:.65}.hybrid-facts sup{font-size:10px;margin-left:5px}.hybrid-art{position:absolute;right:25px;top:80px;width:610px;height:520px}.hybrid-art svg{width:100%;height:100%}.hybrid-frame footer{position:absolute;bottom:30px;left:64px;right:64px;display:flex;justify-content:space-between;gap:30px;font-size:12px;line-height:1.4}.hybrid-frame footer span{max-width:1060px}.hybrid-frame footer b{font-size:14px}`;
