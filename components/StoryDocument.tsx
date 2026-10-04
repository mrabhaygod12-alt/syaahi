import { Fragment, type ReactNode } from "react";
import type { RichNode } from "@/lib/writing/document";
import { articleStyles, normalizeDesign } from "@/lib/writing/design";
import katex from "katex";
import VideoEmbed from "./writer/VideoEmbed";
import {
  STORY_FONTS,
  STORY_SIZES,
  STORY_LINE_HEIGHTS,
  safeColor,
} from "@/lib/writing/formatting";

export default function StoryDocument({
  document,
  fallback,
  embedded = false,
}: {
  document?: RichNode;
  fallback: string;
  embedded?: boolean;
}) {
  if (!document)
    return <div style={{ whiteSpace: "pre-wrap" }}>{fallback}</div>;
  const headings: Array<{ node: RichNode; id: string; text: string }> = [];
  const plain = (n: RichNode): string =>
    n.text || (n.content || []).map(plain).join("");
  const collect = (n: RichNode) => {
    if (n.type === "heading")
      headings.push({
        node: n,
        id: `story-section-${headings.length + 1}`,
        text: plain(n),
      });
    n.content?.forEach(collect);
  };
  collect(document);
  function render(node: RichNode, key: number): ReactNode {
    const children = node.content?.map(render);
    if (node.type === "text") {
      let text: ReactNode = node.text;
      for (const mark of node.marks || []) {
        if (mark.type === "bold") text = <strong>{text}</strong>;
        if (mark.type === "italic") text = <em>{text}</em>;
        if (mark.type === "underline") text = <u>{text}</u>;
        if (mark.type === "strike") text = <s>{text}</s>;
        if (mark.type === "code") text = <code>{text}</code>;
        if (mark.type === "subscript") text = <sub>{text}</sub>;
        if (mark.type === "superscript") text = <sup>{text}</sup>;
        if (mark.type === "highlight")
          text = (
            <mark
              style={{
                backgroundColor: safeColor(mark.attrs?.color)
                  ? mark.attrs!.color
                  : "#fff1ad",
                color: "#242424",
              }}
            >
              {text}
            </mark>
          );
        if (mark.type === "textStyle")
          text = (
            <span
              style={{
                color: safeColor(mark.attrs?.color)
                  ? mark.attrs!.color
                  : undefined,
                backgroundColor: safeColor(mark.attrs?.backgroundColor)
                  ? mark.attrs!.backgroundColor
                  : undefined,
                fontFamily: STORY_FONTS.includes(mark.attrs?.fontFamily || "")
                  ? mark.attrs!.fontFamily
                  : undefined,
                fontSize: STORY_SIZES.includes(mark.attrs?.fontSize || "")
                  ? mark.attrs!.fontSize
                  : undefined,
                lineHeight: STORY_LINE_HEIGHTS.includes(
                  mark.attrs?.lineHeight || "",
                )
                  ? mark.attrs!.lineHeight
                  : undefined,
              }}
            >
              {text}
            </span>
          );
        if (
          mark.type === "link" &&
          /^https?:\/\//i.test(mark.attrs?.href || "")
        )
          text = (
            <a href={mark.attrs!.href} rel="nofollow ugc noopener noreferrer">
              {text}
            </a>
          );
      }
      return <Fragment key={key}>{text}</Fragment>;
    }
    const style = {
      textAlign: node.attrs?.textAlign as
        "left" | "center" | "right" | "justify" | undefined,
      marginLeft: node.attrs?.indent
        ? `${Math.min(5, Number(node.attrs.indent)) * 2}em`
        : undefined,
    };
    switch (node.type) {
      case "heading":
        const headingId = headings.find((h) => h.node === node)?.id;
        return node.attrs?.level === 3 ? (
          <h3 key={key} id={headingId} style={style}>
            {children}
          </h3>
        ) : (
          <h2 key={key} id={headingId} style={style}>
            {children}
          </h2>
        );
      case "paragraph":
        return (
          <p key={key} style={style}>
            {children}
          </p>
        );
      case "tableOfContents":
        return (
          <nav key={key} className="story-contents" aria-label="In this story">
            <strong>In this story</strong>
            {headings.length ? (
              <ol>
                {headings.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`}>{h.text}</a>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No section headings yet.</p>
            )}
          </nav>
        );
      case "equation":
        return (
          <div
            key={key}
            className="story-equation"
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(
                String(node.attrs?.expression || ""),
                {
                  displayMode: true,
                  throwOnError: false,
                  trust: false,
                  maxExpand: 200,
                  maxSize: 10,
                },
              ),
            }}
          />
        );
      case "videoEmbed":
        return <VideoEmbed key={key} id={String(node.attrs?.videoId || "")} />;
      case "bulletList":
        return <ul key={key}>{children}</ul>;
      case "orderedList":
        return (
          <ol key={key} start={Number(node.attrs?.start) || 1}>
            {children}
          </ol>
        );
      case "listItem":
        return <li key={key}>{children}</li>;
      case "table":
        return (
          <div className="story-table-scroll" key={key}>
            <table>
              <tbody>{children}</tbody>
            </table>
          </div>
        );
      case "tableRow":
        return <tr key={key}>{children}</tr>;
      case "tableCell":
        return (
          <td
            key={key}
            colSpan={Number(node.attrs?.colspan) || 1}
            rowSpan={Number(node.attrs?.rowspan) || 1}
          >
            {children}
          </td>
        );
      case "tableHeader":
        return (
          <th
            key={key}
            colSpan={Number(node.attrs?.colspan) || 1}
            rowSpan={Number(node.attrs?.rowspan) || 1}
          >
            {children}
          </th>
        );
      case "blockquote":
        return <blockquote key={key}>{children}</blockquote>;
      case "codeBlock":
        return (
          <pre key={key}>
            <code>{children}</code>
          </pre>
        );
      case "hardBreak":
        return <br key={key} />;
      case "horizontalRule":
        return <hr key={key} />;
      case "image":
        return /^\/api\/writing\/images\/[a-f0-9-]{36}$/.test(
          String(node.attrs?.src),
        ) ? (
          <figure key={key}>
            <img
              src={String(node.attrs?.src)}
              alt={String(node.attrs?.alt || "")}
              loading="lazy"
              style={{ maxWidth: "100%", height: "auto" }}
            />
            {node.attrs?.title && <figcaption>{node.attrs.title}</figcaption>}
          </figure>
        ) : null;
      default:
        return <Fragment key={key}>{children}</Fragment>;
    }
  }
  const design = normalizeDesign(document.attrs);
  return (
    <div
      className={`story-prose ${embedded ? "" : "article-design"} theme-${design.theme} border-${embedded ? "none" : design.pageBorder}`}
      style={articleStyles(document.attrs)}
    >
      {render(document, 0)}
    </div>
  );
}
