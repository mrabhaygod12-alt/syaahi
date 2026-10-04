export interface RichNode {
  type: string;
  text?: string;
  attrs?: Record<string, string | number | null>;
  marks?: Array<{ type: string; attrs?: Record<string, string> }>;
  content?: RichNode[];
}
const blocks = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
  "image",
]);
export function normalizeDocument(value: unknown): RichNode {
  let count = 0,
    characters = 0;
  function clean(input: unknown, depth: number): RichNode {
    if (++count > 3500 || depth > 16 || !input || typeof input !== "object")
      throw new Error("Document is too large or malformed.");
    const node = input as RichNode;
    if (!blocks.has(node.type)) throw new Error("Unsupported document block.");
    const result: RichNode = { type: node.type };
    if (node.type === "text") {
      if (typeof node.text !== "string") throw new Error("Invalid text block.");
      characters += node.text.length;
      if (characters > 50000)
        throw new Error("Story exceeds 50,000 characters.");
      result.text = node.text;
      result.marks = (node.marks || [])
        .filter((m) =>
          ["bold", "italic", "strike", "underline", "code", "link"].includes(
            m.type,
          ),
        )
        .map((m) => {
          if (m.type !== "link") return { type: m.type };
          const href = m.attrs?.href;
          if (
            typeof href !== "string" ||
            href.length > 1200 ||
            !/^https?:\/\//i.test(href)
          )
            throw new Error("Use an HTTP or HTTPS link.");
          return { type: "link", attrs: { href } };
        });
    }
    if (node.type === "heading")
      result.attrs = {
        level: Math.min(3, Math.max(2, Number(node.attrs?.level) || 2)),
      };
    if (
      ["paragraph", "heading"].includes(node.type) &&
      ["left", "center", "right"].includes(String(node.attrs?.textAlign))
    )
      result.attrs = {
        ...result.attrs,
        textAlign: String(node.attrs?.textAlign),
      };
    if (node.type === "image") {
      const src = String(node.attrs?.src || ""),
        alt = String(node.attrs?.alt || "")
          .trim()
          .slice(0, 300);
      if (!/^\/api\/writing\/images\/[a-f0-9-]{36}$/.test(src) || !alt)
        throw new Error("Upload an image and add descriptive alt text.");
      result.attrs = {
        src,
        alt,
        title: String(node.attrs?.title || "").slice(0, 300),
      };
    }
    if (node.content) {
      if (!Array.isArray(node.content))
        throw new Error("Invalid document content.");
      result.content = node.content.map((c) => clean(c, depth + 1));
    }
    return result;
  }
  const result = clean(value, 0);
  if (result.type !== "doc")
    throw new Error("Document must have a root block.");
  return result;
}
export function documentText(node: RichNode): string {
  return node.type === "text"
    ? node.text || ""
    : (node.content || [])
        .map(documentText)
        .join(node.type === "paragraph" || node.type === "heading" ? "" : "\n");
}
export function documentImages(node?: RichNode): string[] {
  if (!node) return [];
  return [
    ...(node.type === "image"
      ? [String(node.attrs?.src).split("/").at(-1)!]
      : []),
    ...(node.content || []).flatMap(documentImages),
  ];
}
export function textDocument(text: string): RichNode {
  return {
    type: "doc",
    content: text
      .split(/\n\s*\n/)
      .map((line) => ({
        type: "paragraph",
        content: line ? [{ type: "text", text: line }] : [],
      })),
  };
}
