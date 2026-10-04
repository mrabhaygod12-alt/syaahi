import { Fragment, type ReactNode } from "react";
import type { RichNode } from "@/lib/writing/document";

export default function StoryDocument({
  document,
  fallback,
}: {
  document?: RichNode;
  fallback: string;
}) {
  if (!document)
    return <div style={{ whiteSpace: "pre-wrap" }}>{fallback}</div>;
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
        "left" | "center" | "right" | undefined,
    };
    switch (node.type) {
      case "heading":
        return node.attrs?.level === 3 ? (
          <h3 key={key} style={style}>
            {children}
          </h3>
        ) : (
          <h2 key={key} style={style}>
            {children}
          </h2>
        );
      case "paragraph":
        return (
          <p key={key} style={style}>
            {children}
          </p>
        );
      case "bulletList":
        return <ul key={key}>{children}</ul>;
      case "orderedList":
        return <ol key={key}>{children}</ol>;
      case "listItem":
        return <li key={key}>{children}</li>;
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
  return <div className="story-prose">{render(document, 0)}</div>;
}
