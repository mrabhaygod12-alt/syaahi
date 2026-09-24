import katex from "katex";
import { parseNote, type Block } from "@/lib/notes/parse";
import type { StyleOpts } from "@/lib/handwriting/options";

export interface PrintNote {
  markdown: string;
  topic?: string;
  footer?: string;
  style?: Partial<StyleOpts>;
  template?: string;
}
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function rich(s: string): string {
  return s
    .split(/(\$\$[^$]+\$\$|\$[^$\n]+\$|`[^`]+`|\*\*[^*]+\*\*)/g)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`"))
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      if (part.startsWith("**") && part.endsWith("**"))
        return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
      if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
        const display = part.startsWith("$$");
        try {
          return katex.renderToString(
            part.slice(display ? 2 : 1, display ? -2 : -1),
            {
              displayMode: display,
              throwOnError: true,
              trust: false,
              maxExpand: 1000,
              output: "html",
            },
          );
        } catch {
          return escapeHtml(part);
        }
      }
      return escapeHtml(part);
    })
    .join("");
}
function block(b: Block): string {
  switch (b.kind) {
    case "title":
      return `<h1 class="block keep">${rich(b.text)}</h1>`;
    case "h3":
      return `<h2 class="block keep">${rich(b.text)}</h2>`;
    case "code":
      return `<pre class="block code"><code>${escapeHtml(b.text)}</code></pre>`;
    case "definition":
      return `<p class="block definition"><b>Definition</b> ${rich(b.text)}</p>`;
    case "bullets":
      return b.items
        .map(
          (t) =>
            `<p class="block bullet"><span class="bullet-dot">•</span>${rich(t)}</p>`,
        )
        .join("");
    case "steps":
      return b.items
        .map((t, i) => `<p class="block step"><b>${i + 1}.</b> ${rich(t)}</p>`)
        .join("");
    case "table":
      return `<table class="block"><thead><tr>${b.head.map((c) => `<th>${rich(c)}</th>`).join("")}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${rich(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    case "diagram": {
      if (b.dtype === "decision")
        return `<section class="block visual decision"><div class="visual-label">Decision</div><div class="decision-question">${rich(b.labels[0])}</div><div class="decision-branches">${b.labels
          .slice(1)
          .map((l) => `<div class="decision-outcome">${rich(l)}</div>`)
          .join("")}</div></section>`;
      return `<section class="block visual"><div class="visual-label">${b.dtype === "cycle" ? "Cycle" : b.dtype === "layers" ? "Layers" : "Flow of ideas"}</div><div class="diagram ${b.dtype}">${b.labels.map((l, i) => `<div class="diagram-node"><span>${String(i + 1).padStart(2, "0")}</span>${rich(l)}</div>${i < b.labels.length - 1 && b.dtype !== "layers" ? '<div class="flow-arrow" aria-hidden="true">↓</div>' : ""}`).join("")}${b.dtype === "cycle" ? '<div class="cycle-return">↩ returns to the first stage</div>' : ""}</div></section>`;
    }
    case "illustration":
      return `<section class="block visual concept-map"><div class="visual-label">Concept connections</div><h3>${rich(b.caption)}</h3><div class="concept-stem"></div><div class="concepts">${b.labels.map((l) => `<span>${rich(l)}</span>`).join("")}</div></section>`;
    case "terms":
    case "timeline":
      return b.items
        .map(
          ([term, text]) =>
            `<p class="block term"><strong>${rich(term)}</strong> · ${rich(text)}</p>`,
        )
        .join("");
    case "alert":
      return `<p class="block alert"><b>Common mistake</b> ${rich(b.text.replace(/^Exam alert:\s*/i, ""))}</p>`;
    case "summary":
      return `<p class="block summary"><b>In a sentence</b> ${rich(b.text)}</p>`;
    case "margin":
      return `<p class="block tip"><b>Remember</b> ${rich(b.text)}</p>`;
    case "sketch":
      return `<p class="block tip"><b>Sketch prompt</b> ${rich(b.text.replace(/^Sketch:\s*/i, ""))}</p>`;
    default:
      return `<p class="block">${rich(b.text)}</p>`;
  }
}

// Both preview and PDF execute this exact measurement/pagination algorithm.
// No anisotropic image resizing, canvas cropping, or model-generated HTML.
const paginate = String.raw`
(async function () {
  try {
    await document.fonts.ready;
    const output = document.getElementById('pages');
    function makeSheet(source) {
      const page = document.createElement('article'); page.className = 'sheet ' + source.dataset.paper;
      page.style.cssText = source.getAttribute('style') || '';
      const body = document.createElement('div'); body.className = 'sheet-body';
      const footer = document.createElement('footer');
      footer.dataset.label = source.dataset.footer || 'Syaahi';
      page.append(body, footer); output.append(page); return body;
    }
    function fits(body) { return body.scrollHeight <= body.clientHeight + 1; }
    function split(node) {
      if (node.tagName === 'TABLE') {
        const rows = Array.from(node.querySelectorAll('tbody tr'));
        if (rows.length > 1) {
          const a=node.cloneNode(true),b=node.cloneNode(true),mid=Math.ceil(rows.length/2);
          a.querySelector('tbody').replaceChildren(...rows.slice(0,mid).map(r=>r.cloneNode(true)));
          b.querySelector('tbody').replaceChildren(...rows.slice(mid).map(r=>r.cloneNode(true)));
          return [a,b];
        }
      }
      const isCode=node.tagName==='PRE';
      const tokens=(node.textContent||'').split(isCode ? '\n' : /\s+/);
      if(tokens.length<2) throw new Error('A block cannot fit on one sheet. Shorten the unbroken text.');
      const mid=Math.ceil(tokens.length/2),a=node.cloneNode(false),b=node.cloneNode(false);
      // Fallback for unusually large blocks preserves text; ordinary blocks retain rich markup.
      a.textContent=tokens.slice(0,mid).join(isCode?'\n':' ');
      b.textContent=tokens.slice(mid).join(isCode?'\n':' ');
      return [a,b];
    }
    for (const source of document.querySelectorAll('.source')) {
      let body=makeSheet(source);
      const pending=Array.from(source.children).map(n=>n.cloneNode(true));
      let guard=0;
      while(pending.length) {
        if(++guard>20000) throw new Error('Layout is too complex. Reduce the document size.');
        const node=pending.shift(); body.append(node);
        if(fits(body)) continue;
        node.remove();
        if(body.children.length) {
          const last=body.lastElementChild;
          const heading=last && last.classList.contains('keep') ? last : null;
          if(heading) heading.remove();
          // An oversized heading must not strand an empty page.
          if(body.children.length) body=makeSheet(source);
          if(heading) body.append(heading);
          body.append(node);
          if(fits(body)) continue;
          node.remove();
        }
        const fragments=split(node); pending.unshift(...fragments);
      }
    }
    const sheets=Array.from(output.children);
    sheets.forEach((sheet,i)=>{
      const foot=sheet.querySelector('footer');
      foot.textContent=foot.dataset.label+' · '+(i+1)+' / '+sheets.length;
    });
    document.getElementById('sources').remove();
    document.documentElement.dataset.ready='true';
    document.documentElement.dataset.pages=String(sheets.length);
    function resize() {
      const width=794; const scale=Math.min(1,innerWidth/width);
      if(!matchMedia('print').matches) {
        output.style.transform='scale('+scale+')'; output.style.transformOrigin='top left';
        document.body.style.height=(output.scrollHeight*scale)+'px';
        parent.postMessage({type:'syaahi-layout',height:output.scrollHeight*scale,pages:sheets.length},'*');
      }
    }
    resize(); addEventListener('resize',resize);
  } catch(error) { document.documentElement.dataset.error=error.message; }
})();`;

export function renderDocument(
  notes: PrintNote[],
  fontCss = "",
  mathCss = "",
): string {
  const sources = notes
    .map((note) => {
      const font = /[\u0900-\u097f]/.test(note.markdown)
        ? "Kalam"
        : ["Caveat", "Kalam", "Patrick Hand"].includes(note.style?.font || "")
          ? note.style!.font!
          : "Caveat";
      const ink = /^#[a-f\d]{6}$/i.test(note.style?.ink || "")
        ? note.style!.ink
        : "#17395d";
      const size = Math.max(20, Math.min(28, Number(note.style?.size || 25)));
      const paper = ["ruled", "plain", "grid", "cream"].includes(
        note.style?.paper || "",
      )
        ? note.style!.paper
        : "cream";
      return `<section class="source" data-paper="${paper} template-${["classic", "poster", "lab", "magazine"].includes(note.template || "") ? note.template : "classic"}" data-footer="${escapeHtml(note.topic || note.footer || "Syaahi · Study notes")}" style="font-family:'${font}',sans-serif;color:${ink};font-size:${size}px">${parseNote(note.markdown).map(block).join("")}</section>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  ${fontCss}\n${mathCss}
  *{box-sizing:border-box}html,body{margin:0;padding:0;background:#eeeae3}body{overflow-x:hidden}#pages{width:210mm}.sheet{width:210mm;height:297mm;padding:15mm 17mm 12mm;display:flex;flex-direction:column;background:#fff;position:relative;margin:0 0 16px;break-after:page;page-break-after:always;font-weight:400;line-height:1.3;font-synthesis:none}
  .sheet:last-child{break-after:auto;page-break-after:auto}.sheet-body{flex:1;min-height:0;display:flow-root}footer{flex-shrink:0;padding-top:4mm;height:10mm;font:10px/1.5 Arial,sans-serif;color:#82776a;border-top:1px solid #ddd2c3;margin-top:4mm}
  .cream{background:#fffdf6}.ruled{background:repeating-linear-gradient(#fff 0 31px,#e8edf5 31px 32px)}.grid{background-color:#fff;background-image:linear-gradient(#edf1f6 1px,transparent 1px),linear-gradient(90deg,#edf1f6 1px,transparent 1px);background-size:24px 24px}
  .block{margin:0 0 8px;overflow-wrap:anywhere;break-inside:avoid}h1{font-size:34px;line-height:1.15;color:#132f4c;padding-bottom:9px;border-bottom:3px solid #e1ac59;margin-bottom:14px!important}h2{font-size:25px;line-height:1.25;color:#966328;margin-top:12px!important}h3{font-size:25px;margin:6px 0 10px}strong{color:#ac3a3a}b{font-weight:700}.definition,.alert,.summary,.tip{padding:8px 12px;background:#eef3f8;border-left:3px solid #52799c;border-radius:3px}.alert{background:#fff1ed;border-color:#c36d55}.summary{background:#edf5ed;border-color:#6d9470}.tip{background:#fff5dd;border-color:#bfa268}.bullet{padding-left:20px;position:relative}.bullet-dot{position:absolute;left:0;color:#c59c55}.step b{color:#966328}
  table{border-collapse:collapse;width:100%;font-size:.85em;table-layout:fixed}td,th{border:1px solid #c9d4de;padding:8px 10px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#edf2f6;color:#264661}tr:nth-child(even){background:#faf8f3}
  code{font-family:Consolas,'Courier New',monospace;font-size:.64em;background:#f0efed;padding:2px 4px;color:#263646;white-space:pre-wrap}.code{padding:14px 16px;background:#f3f4f6;border:1px solid #d9dce0;border-radius:6px;white-space:pre-wrap;font-family:Consolas,'Courier New',monospace;font-size:14px;line-height:1.6;tab-size:4}.code code{font-size:inherit;padding:0;background:none}
  .visual{padding:12px 14px;border:1px solid #ccd7df;border-radius:8px;background:#f8fbfc}.visual-label{font:10px Arial,sans-serif;text-transform:uppercase;letter-spacing:1.4px;color:#658095;margin-bottom:10px}.diagram{display:flex;flex-direction:column;gap:8px}.diagram-node{display:flex;align-items:center;gap:12px;border-left:3px solid #7c9caa;background:white;padding:6px 10px;font-size:22px}.diagram-node span{font:12px Arial,sans-serif;color:#917039}.concepts{display:flex;gap:8px;flex-wrap:wrap}.concepts span{background:#edf3ed;border:1px solid #b9cebb;border-radius:6px;padding:5px 12px;font-size:21px}.katex{font-size:.85em}.katex-display{margin:8px 0}.term{border-bottom:1px solid #e5e3db;padding-bottom:8px}
  .template-poster h1{background:#17395d;color:white;padding:16px;border:0}.template-lab h1{color:#176c69;border-color:#4ba8a0}.template-lab .definition{background:#e8f5f1;border-color:#37887a}.template-magazine h1{font-family:Georgia,serif;font-size:31px}.template-magazine h2{color:#844c52}.template-magazine th{background:#f3e8e3}
  .diagram{gap:0;max-width:460px;margin:auto}.diagram-node{border:1.5px solid #7797aa;border-radius:7px;padding:4px 10px;font-size:21px;background:#fffefa;justify-content:center}.diagram-node span{color:#b08442}.flow-arrow{text-align:center;font-size:22px;line-height:18px;color:#668794}.layers{gap:5px}.layers .diagram-node:nth-child(even){background:#eaf2ef}.cycle{border-left:2px dashed #adc0b2;padding-left:16px}.cycle-return{font-size:17px;text-align:center;color:#517962;margin-top:8px}.concept-map h3{text-align:center;border:1.5px solid #8ba995;border-radius:50%;padding:10px 18px;max-width:75%;margin:0 auto}.concept-stem{height:20px;border-left:1.5px solid #8ba995;margin-left:50%}.concepts{justify-content:center;border-top:1.5px solid #8ba995;padding-top:15px;gap:12px}.concepts span{position:relative;max-width:45%;text-align:center;background:#fffefa}.concepts span:before{content:'';position:absolute;height:16px;border-left:1.5px solid #8ba995;top:-17px;left:50%}.decision-question{max-width:80%;margin:0 auto 24px;text-align:center;padding:12px 22px;background:#fff1d4;border:1.5px solid #b69867;border-radius:30px;position:relative}.decision-question:after{content:'';position:absolute;height:25px;bottom:-25px;left:50%;border-left:1.5px solid #8ba995}.decision-branches{display:flex;justify-content:space-around;gap:20px;border-top:1.5px solid #8ba995;padding-top:22px}.decision-outcome{flex:1;max-width:47%;padding:10px;border:1.5px solid #8ba995;border-radius:7px;background:#edf5ee;position:relative;text-align:center}.decision-outcome:before{content:'↓';position:absolute;top:-29px;left:48%;font-size:22px;color:#668794}
  #sources{position:absolute;left:-10000px;width:176mm;visibility:hidden}
  @page{size:A4;margin:0}@media print{html,body{background:white!important;height:auto!important}#pages{transform:none!important}.sheet{margin:0!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body><main id="pages"></main><div id="sources">${sources}</div><script>${paginate}</script></body></html>`;
}
