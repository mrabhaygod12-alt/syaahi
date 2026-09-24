import type { PaperId } from "./options";

// Client-side handwriting jitter renderer (Canvas 2D).
// Draws EVERY character with its own rotation (±jitter deg), x/y offset and
// size variation (±5%) — this is what separates real-looking output from flat fonts.

const PAPER_BG: Record<PaperId, string> = {
  ruled: "#ffffff",
  plain: "#ffffff",
  grid: "#ffffff",
  cream: "#fdf8ec",
};

export function drawHandwriting(
  canvas: HTMLCanvasElement,
  text: string,
  opts?: {
    font?: string;
    ink?: string;
    size?: number;
    jitter?: number;
    paper?: PaperId;
  },
) {
  const {
    font = "Caveat",
    ink = "#1a2a6b",
    size = 30,
    jitter = 2,
    paper = "ruled",
  } = opts ?? {};
  const ctx = canvas.getContext("2d")!;
  const W = (canvas.width = 794);
  const lineH = 33;
  const plain = text.replace(/[#*_`>]/g, "");
  const words = plain.split(/\s+/);
  ctx.font = `${size}px ${font}`;
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > W - 140) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  canvas.height = Math.max(1123, 120 + lines.length * lineH);

  // paper base
  ctx.fillStyle = PAPER_BG[paper];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (paper === "ruled" || paper === "cream") {
    ctx.strokeStyle = paper === "cream" ? "#e8dcc0" : "#dbe7ff";
    for (let y = 64; y < canvas.height; y += 33) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(224,52,43,.35)";
    ctx.fillRect(48, 0, 2, canvas.height);
  } else if (paper === "grid") {
    ctx.strokeStyle = "#e3ecff";
    for (let x = 0; x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  let y = 100;
  ctx.fillStyle = ink;
  for (const line of lines) {
    let x = 70;
    for (const ch of line) {
      const angle = ((Math.random() - 0.5) * jitter * Math.PI) / 180;
      const dx = (Math.random() - 0.5) * jitter * 0.8;
      const dy = (Math.random() - 0.5) * jitter * 0.6;
      const s = size * (1 + (Math.random() - 0.5) * 0.05);
      ctx.save();
      ctx.translate(x + dx, y + dy);
      ctx.rotate(angle);
      ctx.font = `${s}px ${font}`;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      x += ctx.measureText(ch).width;
    }
    y += lineH;
  }
}
