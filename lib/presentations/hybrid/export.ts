import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import { writingImage } from "@/lib/writing/images";
import { chromium } from "playwright";
import type { Deck } from "../store";
import {
  manifestHtml,
  FRAME_CSS,
  visualNodes,
  xml,
  VERTEX_SHADER,
  FRAGMENT_SHADER,
} from "./visual";
import { validateManifest } from "./model";
import { rendererLease } from "./resources";
export function checkedSlides(deck: Deck) {
  if (
    deck.designEngine !== 3 ||
    deck.status !== "done" ||
    deck.quality?.status !== "passed"
  )
    throw new Error("Wait for this presentation to pass its delivery checks.");
  return deck.slides.map((s) => validateManifest(s.manifest));
}
export async function brandImages(deck: Deck) {
  const result: Record<string, string> = {};
  for (const slide of checkedSlides(deck)) {
    const id = slide.genome.logoId;
    if (!id || result[id]) continue;
    const image = await writingImage(id);
    if (!image || image.owner !== deck.owner)
      throw new Error("Brand logo unavailable.");
    const png = await sharp(image.bytes)
      .resize({
        width: 256,
        height: 256,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    result[id] = "data:image/png;base64," + png.toString("base64");
  }
  return result;
}
export async function hybridPptx(deck: Deck) {
  const slides = checkedSlides(deck),
    pptx = new PptxGenJS();
  const logos = await brandImages(deck);
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Syaahi user";
  pptx.title = deck.title;
  pptx.subject = "Source-backed presentation";
  for (const [index, s] of slides.entries()) {
    const slide = pptx.addSlide(),
      g = s.genome,
      ink = g.ink.slice(1),
      accent = g.accent.slice(1);
    slide.background = { color: g.canvas.slice(1) };
    if (g.logoId && logos[g.logoId])
      slide.addImage({
        data: logos[g.logoId],
        x: 12,
        y: 0.3,
        w: 0.65,
        h: 0.57,
      });
    slide.addText(s.category, {
      x: 0.666,
      y: 0.68,
      w: 5.7,
      h: 0.25,
      fontFace: g.font,
      fontSize: 10,
      color: ink,
      charSpacing: 2,
      margin: 0,
    });
    slide.addText(s.headline, {
      x: 0.666,
      y: 1.18,
      w: 5.7,
      h: 1.68,
      fontFace: g.font,
      fontSize: 35,
      bold: true,
      color: ink,
      margin: 0,
      breakLine: false,
      fit: "shrink",
      valign: "top",
    });
    s.facts.forEach((f, i) => {
      slide.addText(String(i + 1).padStart(2, "0"), {
        x: 0.666,
        y: 3.05 + i * 1.06,
        w: 0.3,
        h: 0.25,
        fontSize: 8,
        color: accent,
        margin: 0,
      });
      slide.addText(`${f.statement} [${i + 1}]`, {
        x: 1.04,
        y: 3.0 + i * 1.06,
        w: 5.3,
        h: 1,
        fontFace: g.font,
        fontSize: 16,
        color: ink,
        margin: 0,
        fit: "shrink",
        valign: "top",
      });
    });
    const nodes = visualNodes(s);
    nodes.forEach((p, i) => {
      const q = nodes[(i + 1) % nodes.length],
        x = 7.05 + (p.x / 500) * 5.4;
      slide.addShape(pptx.ShapeType.line, {
        x: 7.05 + (Math.min(p.x, q.x) / 500) * 5.4,
        y: 1 + (Math.min(p.y, q.y) / 500) * 5.4,
        w: (Math.abs(q.x - p.x) / 500) * 5.4,
        h: (Math.abs(q.y - p.y) / 500) * 5.4,
        flipH: q.x < p.x,
        flipV: q.y < p.y,
        line: { color: g.secondary.slice(1), width: 0.7, transparency: 55 },
      });
      const r = (p.r / 500) * 5.4;
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x - r,
        y: 1 + (p.y / 500) * 5.4 - r,
        w: r * 2,
        h: r * 2,
        fill: { color: i % 2 ? accent : g.secondary.slice(1) },
        line: { color: accent, transparency: 100 },
      });
    });
    slide.addText(
      s.facts
        .map(
          (f, i) =>
            `[${i + 1}] ${f.documentTitle}${f.pageNumber ? `, p. ${f.pageNumber}` : ""}`,
        )
        .join(" · "),
      {
        x: 0.666,
        y: 6.85,
        w: 11.4,
        h: 0.28,
        fontSize: 8,
        color: ink,
        margin: 0,
        fit: "shrink",
      },
    );
    slide.addText(String(index + 1).padStart(2, "0"), {
      x: 12.2,
      y: 6.85,
      w: 0.45,
      h: 0.25,
      fontSize: 10,
      color: ink,
      align: "right",
      margin: 0,
    });
    slide.addNotes(s.notes);
  }
  return Buffer.from(
    (await pptx.write({ outputType: "nodebuffer" })) as Buffer,
  );
}
export function hybridHtml(deck: Deck, logos: Record<string, string> = {}) {
  const slides = checkedSlides(deck);
  return `<!doctype html><html lang="${/^hindi/i.test(deck.language) ? "hi" : "en"}"><head><meta charset="utf-8"><title>${xml(deck.title)}</title><style>${FRAME_CSS}@page{size:13.333333in 7.5in;margin:0}html,body{margin:0}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.hybrid-frame{break-after:page}.hybrid-frame:last-child{break-after:auto}</style></head><body>${slides.map((s, i) => manifestHtml(s, i, logos[s.genome.logoId || ""])).join("")}</body></html>`;
}
export async function hybridVisualExport(
  deck: Deck,
  format: "pdf" | "png" | "notes",
  index = 0,
) {
  const slides = checkedSlides(deck);
  if (!Number.isInteger(index) || index < 0 || index >= slides.length)
    throw new Error("Choose an existing scene.");
  const release = await rendererLease();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, timeout: 30000 });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    });
    await page.route("**/*", (r) => r.abort());
    const html =
      format === "notes"
        ? `<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px/1.7 Arial;padding:35px}article{break-after:page}pre{white-space:pre-wrap}</style></head><body>${slides.map((s, i) => `<article><h1>${i + 1}. ${xml(s.headline)}</h1><pre>${xml(s.notes)}</pre></article>`).join("")}</body></html>`
        : hybridHtml(deck, await brandImages(deck));
    await page.setContent(html);
    if (format === "png")
      return await page
        .locator(".hybrid-frame")
        .nth(index)
        .screenshot({ type: "png" });
    return await page.pdf(
      format === "notes"
        ? { format: "A4", printBackground: true }
        : {
            width: "13.333333in",
            height: "7.5in",
            printBackground: true,
            preferCSSPageSize: true,
          },
    );
  } finally {
    await browser?.close();
    await release();
  }
}
export function portableWebDeck(
  deck: Deck,
  logos: Record<string, string> = {},
) {
  const slides = checkedSlides(deck).map((s) => ({
    ...s,
    notes: "",
    facts: s.facts.map((f) => ({
      ...f,
      sourceId: "",
      start: 0,
      end: f.statement.length,
      exactQuote: f.statement,
    })),
    genome: { ...s.genome, logoId: undefined },
  }));
  const palette = slides.map((s) => s.genome.accent),
    shader = JSON.stringify({
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      palette,
    }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#10191d"><title>${xml(deck.title)}</title><style>${FRAME_CSS}body{margin:0;background:#0c1316;color:#f3f8f2;font-family:Arial}main{position:relative;width:100vw;height:calc(100dvh - 62px);display:grid;place-items:center}.deck-page{display:none;width:min(100vw,calc((100dvh - 62px)*16/9));aspect-ratio:16/9;position:relative;overflow:hidden;container-type:inline-size}.deck-page.active{display:block}.hybrid-frame{position:absolute;inset:0;width:100%;height:100%;padding:5cqw}.hybrid-copy{width:44%}.hybrid-category{font-size:1.02cqw}.hybrid-frame h1{font-size:3.75cqw;margin:2.35cqw 0 2.7cqw;max-height:13.3cqw}.hybrid-facts{gap:1.4cqw}.hybrid-facts p{font-size:1.56cqw;padding-left:2.74cqw;max-height:7.8cqw}.hybrid-facts p>span{font-size:.78cqw}.hybrid-facts sup{font-size:.78cqw}.hybrid-art{right:2%;top:10%;width:47.6%;height:74%;transform-style:preserve-3d;transition:transform .5s}.hybrid-frame footer{left:5%;right:5%;bottom:4.2%;font-size:.94cqw}.hybrid-frame footer b{font-size:1.1cqw}nav{height:62px;display:flex;align-items:center;justify-content:center;gap:18px;border-top:1px solid #334c3d}button{background:#23392b;color:#dceede;border:1px solid #48674f;border-radius:8px;padding:10px 16px;cursor:pointer}button:focus-visible{outline:2px solid white}#counter{font-size:12px}#gpu{position:absolute;right:2%;top:10%;width:47.6%;height:74%;pointer-events:none;opacity:.5}.hybrid-frame footer span{max-width:90%}@media(prefers-reduced-motion:reduce){*{transition:none!important}}</style></head><body><main>${slides.map((s, i) => `<section class="deck-page${i === 0 ? " active" : ""}" aria-label="Slide ${i + 1}">${manifestHtml(s, i, logos[deck.slides[i].manifest!.genome.logoId || ""])}</section>`).join("")}</main><nav aria-label="Deck controls"><button id="prev" aria-label="Previous slide">←</button><span id="counter">1 / ${slides.length}</span><button id="next" aria-label="Next slide">→</button><button id="full">Fullscreen</button></nav><script>(function(){"use strict";const pages=[...document.querySelectorAll('.deck-page')],counter=document.getElementById('counter');let index=0;function show(n){index=Math.max(0,Math.min(pages.length-1,n));pages.forEach((p,i)=>p.classList.toggle('active',i===index));counter.textContent=(index+1)+' / '+pages.length;}document.getElementById('prev').onclick=()=>show(index-1);document.getElementById('next').onclick=()=>show(index+1);document.getElementById('full').onclick=()=>document.documentElement.requestFullscreen?.();addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();show(index+1);}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();show(index-1);}if(e.key==='Home')show(0);if(e.key==='End')show(pages.length-1);});if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelector('main').onpointermove=e=>{const art=pages[index].querySelector('.hybrid-art');if(art)art.style.transform='perspective(900px) rotateY('+((e.clientX/innerWidth-.5)*18)+'deg) rotateX('+((.5-e.clientY/innerHeight)*12)+'deg)';};}const shaders=${shader};const canvas=document.createElement('canvas');canvas.id='gpu';pages[0].append(canvas);const gl=canvas.getContext('webgl',{alpha:true});if(!gl||matchMedia('(prefers-reduced-motion: reduce)').matches)return;function compile(t,c){const s=gl.createShader(t);gl.shaderSource(s,c);gl.compileShader(s);return gl.getShaderParameter(s,gl.COMPILE_STATUS)?s:null;}const v=compile(gl.VERTEX_SHADER,shaders.vertex),f=compile(gl.FRAGMENT_SHADER,shaders.fragment);if(!v||!f)return;const program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;gl.useProgram(program);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const p=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);function draw(ms){pages[index].append(canvas);canvas.width=Math.max(1,canvas.clientWidth);canvas.height=Math.max(1,canvas.clientHeight);gl.viewport(0,0,canvas.width,canvas.height);const h=shaders.palette[index];gl.uniform3fv(gl.getUniformLocation(program,'u_accent'),[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255));gl.uniform1f(gl.getUniformLocation(program,'u_time'),ms/1000);gl.drawArrays(gl.TRIANGLES,0,6);requestAnimationFrame(draw);}requestAnimationFrame(draw);})();</script></body></html>`;
}
