// Markdown → structured note blocks. Preserves the AI's one-page template
// (## title, **Definition:**, ### sections, - bullets) instead of flattening it.
export type Block =
  | { kind: "code"; text: string; language: string }
  | { kind: "title"; text: string }
  | { kind: "definition"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "alert"; text: string }
  | { kind: "margin"; text: string }
  | { kind: "timeline"; items: Array<[string, string]> }
  | { kind: "terms"; items: Array<[string, string]> }
  | {
      kind: "diagram";
      dtype: "cycle" | "layers" | "flow" | "decision";
      labels: string[];
    }
  | { kind: "illustration"; caption: string; labels: string[] }
  | { kind: "summary"; text: string }
  | { kind: "sketch"; text: string }
  | { kind: "para"; text: string };

function splitRow(line: string): string[] {
  return line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => inline(c));
}
function isTableRow(line: string): boolean {
  return line.startsWith("|") && line.slice(1).includes("|");
}

function isSketch(s: string): boolean {
  return (
    /^(sketch|draw|diagram)\s*:/i.test(s) ||
    (/draw|diagram|sketch|label (it|the)/i.test(s) && s.length < 160)
  );
}

// "Diagram: cycle | Evaporation | Condensation | Rain" → animated SVG diagram.
function parseDiagram(line: string): Block | null {
  const m = line.match(/^diagram\s*:\s*(.+)/i);
  if (!m) return null;
  const parts = m[1]
    .split("|")
    .map((s) => inline(s))
    .filter(Boolean);
  const t = (parts[0] ?? "").toLowerCase();
  const dtype = t.includes("decision")
    ? "decision"
    : t.includes("layer")
      ? "layers"
      : t.includes("flow") || t.includes("process")
        ? "flow"
        : "cycle";
  const labels = parts.slice(1, 7);
  if (!labels.length) return null;
  return { kind: "diagram", dtype, labels };
}

// "Illustration: Solar panel | photons | electrons | current" → mind-map SVG image.
function parseIllustration(line: string): Block | null {
  const m = line.match(/^illustration\s*:\s*(.+)/i);
  if (!m) return null;
  const parts = m[1]
    .split("|")
    .map((s) => inline(s))
    .filter(Boolean);
  if (!parts.length) return null;
  return {
    kind: "illustration",
    caption: parts[0].slice(0, 80),
    labels: parts.slice(1, 5),
  };
}

// "1947 :: Independence" → timeline; "Photosynthesis :: food-making" → terms grid.
function parsePair(
  line: string,
): { left: string; right: string; timeline: boolean } | null {
  const m = line.match(/^(.+?)\s*::\s*(.+)$/);
  if (!m) return null;
  const left = inline(m[1]);
  const right = inline(m[2]);
  if (!left || !right) return null;
  return { left, right, timeline: /^\d{3,4}(\s?(AD|BC|CE|BCE))?$/.test(left) };
}

export function inline(s: string): string {
  // Keep **key-term** markers for the renderer (colored keywords);
  // strip only code ticks. Formulas like 6O2 -> 6CO2 survive intact.
  return s.trim();
}

export function parseNote(md: string): Block[] {
  const blocks: Block[] = [];
  let bullets: string[] = [];
  let steps: string[] = [];
  let code: string[] | null = null;
  let codeLanguage = "";
  const flush = () => {
    if (bullets.length) {
      blocks.push({ kind: "bullets", items: bullets });
      bullets = [];
    }
    if (steps.length) {
      blocks.push({ kind: "steps", items: steps });
      steps = [];
    }
  };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      flush();
      if (code) {
        blocks.push({
          kind: "code",
          text: code.join("\n"),
          language: codeLanguage,
        });
        code = null;
      } else {
        code = [];
        codeLanguage = line.slice(3).trim();
      }
      continue;
    }
    if (code) {
      code.push(raw);
      continue;
    }
    if (!line) continue;
    // Markdown tables → compare-table block.
    if (isTableRow(line)) {
      flush();
      const cells = splitRow(line);
      if (cells.every((c) => /^:?-+:?$/.test(c) || c === "")) continue; // separator row
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === "table" && prev.head.length === cells.length)
        prev.rows.push(cells);
      else if (cells.length >= 2)
        blocks.push({ kind: "table", head: cells, rows: [] });
      continue;
    }
    // Numbered steps → flowchart block.
    const step = line.match(/^(?:\d+[.)]\s+)(.+)/);
    if (step) {
      if (bullets.length) {
        blocks.push({ kind: "bullets", items: bullets });
        bullets = [];
      }
      steps.push(inline(step[1]));
      continue;
    } else if (steps.length) {
      blocks.push({ kind: "steps", items: steps });
      steps = [];
    }
    // Animated diagram directive.
    if (/^diagram\s*:/i.test(line)) {
      flush();
      const dg = parseDiagram(line);
      if (dg) {
        blocks.push(dg);
        continue;
      }
    }
    // Mind-map illustration directive (SVG image, PDF-safe).
    if (/^illustration\s*:/i.test(line)) {
      flush();
      const il = parseIllustration(line);
      if (il) {
        blocks.push(il);
        continue;
      }
    }
    // Timeline / terms pairs ("1947 :: Independence", "Mitochondria :: powerhouse").
    if (line.includes("::")) {
      const pr = parsePair(line);
      if (pr) {
        flush();
        const prev = blocks[blocks.length - 1];
        const kind = pr.timeline ? "timeline" : "terms";
        if (prev && prev.kind === kind)
          (prev as any).items.push([pr.left, pr.right]);
        else blocks.push({ kind, items: [[pr.left, pr.right]] } as any);
        continue;
      }
    }
    if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "title", text: inline(line.slice(3)) });
      continue;
    }
    if (line.startsWith("### ")) {
      flush();
      blocks.push({ kind: "h3", text: inline(line.slice(4)) });
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      bullets.push(inline(line.replace(/^[-*•]\s+/, "")));
      continue;
    }
    if (line.startsWith(">")) {
      flush();
      blocks.push({ kind: "alert", text: inline(line.replace(/^>\s?/, "")) });
      continue;
    }
    if (line.startsWith("! ")) {
      flush();
      blocks.push({ kind: "margin", text: inline(line.slice(2)) });
      continue;
    }
    const sum =
      line.match(/^\*\*Summary:\*\*\s*(.*)/) ?? line.match(/^Summary:\s*(.*)/i);
    if (sum) {
      flush();
      blocks.push({ kind: "summary", text: inline(sum[1]) });
      continue;
    }
    const def =
      line.match(/^\*\*Definition:\*\*\s*(.*)/) ??
      line.match(/^Definition:\s*(.*)/i);
    if (def) {
      flush();
      blocks.push({ kind: "definition", text: inline(def[1]) });
      continue;
    }
    flush();
    const clean = inline(line);
    blocks.push(
      isSketch(clean)
        ? { kind: "sketch", text: clean }
        : { kind: "para", text: clean },
    );
  }
  flush();
  if (code?.length)
    blocks.push({
      kind: "code",
      text: code.join("\n"),
      language: codeLanguage,
    });
  return blocks.filter((b) => {
    if (b.kind === "bullets" || b.kind === "steps") return b.items.length > 0;
    if (b.kind === "table")
      return b.head.length > 0 && (b.rows.length > 0 || b.head.length >= 2);
    if (b.kind === "timeline" || b.kind === "terms" || b.kind === "diagram")
      return (b as any).items?.length > 0 || (b as any).labels?.length > 0;
    if (b.kind === "illustration") return (b as any).caption?.length > 0;
    return (b as any).text?.length > 0;
  });
}
