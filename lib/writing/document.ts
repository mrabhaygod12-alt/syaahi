import {
  STORY_FONTS,
  STORY_SIZES,
  STORY_LINE_HEIGHTS,
  safeColor,
} from "./formatting";
import { normalizeDesign } from "./design";
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
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "equation",
  "tableOfContents",
  "videoEmbed",
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
    if (node.type === "doc" && node.attrs)
      result.attrs = normalizeDesign(node.attrs);
    if (node.type === "equation") {
      const expression = String(node.attrs?.expression || "").trim();
      if (!expression || expression.length > 500)
        throw new Error("Equations need 1–500 characters.");
      characters += expression.length;
      if (characters > 50000)
        throw new Error("Story exceeds 50,000 characters.");
      result.attrs = { expression };
    }
    if (node.type === "videoEmbed") {
      const videoId = String(node.attrs?.videoId || "");
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId))
        throw new Error("Use a valid YouTube video.");
      result.attrs = { videoId };
    }
    if (node.type === "text") {
      if (typeof node.text !== "string") throw new Error("Invalid text block.");
      characters += node.text.length;
      if (characters > 50000)
        throw new Error("Story exceeds 50,000 characters.");
      result.text = node.text;
      result.marks = (node.marks || [])
        .filter((m) =>
          [
            "bold",
            "italic",
            "strike",
            "underline",
            "code",
            "link",
            "subscript",
            "superscript",
            "highlight",
            "textStyle",
          ].includes(m.type),
        )
        .map((m) => {
          if (m.type === "highlight")
            return {
              type: m.type,
              attrs: {
                color: safeColor(m.attrs?.color) ? m.attrs!.color : "#fff1ad",
              },
            };
          if (m.type === "textStyle") {
            const attrs: Record<string, string> = {};
            if (safeColor(m.attrs?.color)) attrs.color = m.attrs!.color;
            if (safeColor(m.attrs?.backgroundColor))
              attrs.backgroundColor = m.attrs!.backgroundColor;
            if (STORY_FONTS.includes(m.attrs?.fontFamily || ""))
              attrs.fontFamily = m.attrs!.fontFamily;
            if (STORY_SIZES.includes(m.attrs?.fontSize || ""))
              attrs.fontSize = m.attrs!.fontSize;
            if (STORY_LINE_HEIGHTS.includes(m.attrs?.lineHeight || ""))
              attrs.lineHeight = m.attrs!.lineHeight;
            return { type: m.type, attrs };
          }
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
      ["left", "center", "right", "justify"].includes(
        String(node.attrs?.textAlign),
      )
    )
      result.attrs = {
        ...result.attrs,
        textAlign: String(node.attrs?.textAlign),
      };
    if (
      ["paragraph", "heading"].includes(node.type) &&
      Number.isInteger(node.attrs?.indent)
    )
      result.attrs = {
        ...result.attrs,
        indent: Math.max(0, Math.min(5, Number(node.attrs!.indent))),
      };
    if (node.type === "orderedList")
      result.attrs = {
        start: Math.max(1, Math.min(999, Number(node.attrs?.start) || 1)),
      };
    if (["tableCell", "tableHeader"].includes(node.type))
      result.attrs = {
        colspan: Math.max(1, Math.min(12, Number(node.attrs?.colspan) || 1)),
        rowspan: Math.max(1, Math.min(100, Number(node.attrs?.rowspan) || 1)),
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
    const allowed: Record<string, string[]> = {
      doc: [
        "equation",
        "tableOfContents",
        "videoEmbed",
        "paragraph",
        "heading",
        "bulletList",
        "orderedList",
        "blockquote",
        "codeBlock",
        "horizontalRule",
        "image",
        "table",
      ],
      paragraph: ["text", "hardBreak"],
      heading: ["text", "hardBreak"],
      codeBlock: ["text"],
      bulletList: ["listItem"],
      orderedList: ["listItem"],
      listItem: [
        "equation",
        "tableOfContents",
        "videoEmbed",
        "paragraph",
        "heading",
        "bulletList",
        "orderedList",
        "blockquote",
        "codeBlock",
        "image",
        "table",
      ],
      blockquote: [
        "equation",
        "tableOfContents",
        "videoEmbed",
        "paragraph",
        "heading",
        "bulletList",
        "orderedList",
        "blockquote",
        "codeBlock",
        "image",
        "table",
      ],
      table: ["tableRow"],
      tableRow: ["tableCell", "tableHeader"],
      tableCell: [
        "equation",
        "tableOfContents",
        "videoEmbed",
        "paragraph",
        "heading",
        "bulletList",
        "orderedList",
        "blockquote",
        "codeBlock",
        "image",
      ],
      tableHeader: [
        "equation",
        "tableOfContents",
        "videoEmbed",
        "paragraph",
        "heading",
        "bulletList",
        "orderedList",
        "blockquote",
        "codeBlock",
        "image",
      ],
    };
    if (
      (result.content || []).some(
        (child) => !(allowed[node.type] || []).includes(child.type),
      )
    )
      throw new Error("Invalid document structure.");
    if (
      [
        "table",
        "tableRow",
        "tableCell",
        "tableHeader",
        "listItem",
        "bulletList",
        "orderedList",
        "blockquote",
      ].includes(node.type) &&
      !result.content?.length
    )
      throw new Error("Empty structural block.");
    return result;
  }
  const result = clean(value, 0);
  if (result.type !== "doc")
    throw new Error("Document must have a root block.");
  return result;
}
export function documentText(node: RichNode): string {
  if (node.type === "equation") return String(node.attrs?.expression || "");
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
    content: text.split(/\n\s*\n/).map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}
