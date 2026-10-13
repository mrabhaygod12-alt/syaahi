import { documentText, type RichNode } from "./document";

function safeLink(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Small Markdown subset for legacy published text. No HTML or external images. */
function inline(value: string, depth = 0): RichNode[] {
  if (depth >= 4) return [{ type: "text", text: value }];
  const pattern =
    /(`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
  const nodes: RichNode[] = [];
  let at = 0;
  for (const match of value.matchAll(pattern)) {
    const offset = match.index!;
    if (offset > at)
      nodes.push({ type: "text", text: value.slice(at, offset) });
    const token = match[0];
    if (token.startsWith("`"))
      nodes.push({
        type: "text",
        text: token.slice(1, -1),
        marks: [{ type: "code" }],
      });
    else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\((.+)\)$/)!;
      const href = safeLink(link[2]);
      nodes.push(
        ...inline(link[1], depth + 1).map((node) =>
          href
            ? {
                ...node,
                marks: [
                  ...(node.marks || []),
                  { type: "link", attrs: { href } },
                ],
              }
            : node,
        ),
      );
    } else {
      const bold = token.startsWith("**") || token.startsWith("__");
      nodes.push(
        ...inline(token.slice(bold ? 2 : 1, bold ? -2 : -1), depth + 1).map(
          (node) => ({
            ...node,
            marks: [...(node.marks || []), { type: bold ? "bold" : "italic" }],
          }),
        ),
      );
    }
    at = offset + token.length;
  }
  if (at < value.length) nodes.push({ type: "text", text: value.slice(at) });
  return nodes;
}

export function legacyReaderDocument(body: string): RichNode {
  const content: RichNode[] = [];
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length)
      content.push({
        type: "paragraph",
        content: inline(paragraph.join("\n")),
      });
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s*```/.test(line)) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !/^\s*```\s*$/.test(lines[i]))
        code.push(lines[i]);
      content.push({
        type: "codeBlock",
        content: [{ type: "text", text: code.join("\n") }],
      });
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      content.push({
        type: "heading",
        attrs: { level: heading[1].length <= 2 ? 2 : 3 },
        content: inline(heading[2]),
      });
      continue;
    }
    if (/^\s{0,3}(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      flush();
      content.push({ type: "horizontalRule" });
      continue;
    }
    const list = line.match(/^\s{0,3}(?:([-+*])\s+|(\d{1,6})[.)]\s+)(.+)$/);
    if (list) {
      flush();
      const type = list[2] ? "orderedList" : "bulletList";
      let block = content.at(-1);
      if (block?.type !== type) {
        block = {
          type,
          ...(list[2] ? { attrs: { start: Number(list[2]) } } : {}),
          content: [],
        };
        content.push(block);
      }
      block.content!.push({
        type: "listItem",
        content: [{ type: "paragraph", content: inline(list[3]) }],
      });
      continue;
    }
    if (/^\s{0,3}>\s?/.test(line)) {
      flush();
      const quote: string[] = [line.replace(/^\s{0,3}>\s?/, "")];
      while (i + 1 < lines.length && /^\s{0,3}>\s?/.test(lines[i + 1]))
        quote.push(lines[++i].replace(/^\s{0,3}>\s?/, ""));
      content.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: inline(quote.join("\n")) }],
      });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return { type: "doc", content };
}

export const readerDocument = (document: RichNode | undefined, body: string) =>
  document || legacyReaderDocument(body);
export const readerDocumentText = (
  document: RichNode | undefined,
  body: string,
) => documentText(readerDocument(document, body));
export function readerHeadings(document: RichNode) {
  const headings: { id: string; text: string; level: number }[] = [];
  const visit = (node: RichNode) => {
    if (node.type === "heading")
      headings.push({
        id: `story-section-${headings.length + 1}`,
        text: documentText(node),
        level: Number(node.attrs?.level) === 3 ? 3 : 2,
      });
    node.content?.forEach(visit);
  };
  visit(document);
  return headings;
}

export function readerCover(
  document?: RichNode,
): { src: string; alt: string } | null {
  if (!document) return null;
  if (
    document.type === "image" &&
    /^\/api\/writing\/images\/[a-f0-9-]{36}$/.test(String(document.attrs?.src))
  )
    return {
      src: String(document.attrs?.src),
      alt: String(document.attrs?.alt || "Story illustration"),
    };
  for (const child of document.content || []) {
    const cover = readerCover(child);
    if (cover) return cover;
  }
  return null;
}
