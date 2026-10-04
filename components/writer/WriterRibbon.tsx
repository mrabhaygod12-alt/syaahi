"use client";
import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  STORY_FONTS,
  STORY_SIZES,
  STORY_LINE_HEIGHTS,
} from "@/lib/writing/formatting";
import Modal from "../Modal";
export default function WriterRibbon({
  editor,
  disabled,
  image,
  history,
  preview,
  focus,
  message,
}: {
  editor: Editor | null;
  disabled: boolean;
  image: () => void;
  history: () => void;
  preview: () => void;
  focus: () => void;
  message: (s: string) => void;
}) {
  const [tab, setTab] = useState("Home"),
    [link, setLink] = useState<string | null>(null),
    [linkError, setLinkError] = useState(""),
    [findOpen, setFindOpen] = useState(false),
    [find, setFind] = useState(""),
    [replace, setReplace] = useState(""),
    [matchIndex, setMatchIndex] = useState(0),
    [painter, setPainter] = useState<Array<{
      type: string;
      attrs?: Record<string, any>;
    }> | null>(null);
  const blocked = !editor || disabled;
  const tool = (
    label: string,
    text: string,
    run: () => unknown,
    pressed?: boolean,
    unavailable = false,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={blocked || unavailable}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => run()}
    >
      {text}
    </button>
  );
  function matches() {
    const list: Array<{ from: number; to: number }> = [];
    if (!find || !editor) return list;
    editor.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      let text = "";
      const positions: number[] = [];
      node.descendants((child, offset) => {
        if (child.isText && child.text) {
          for (let i = 0; i < child.text.length; i++)
            positions.push(pos + 1 + offset + i);
          text += child.text;
        } else if (child.isInline) {
          text += "\n";
          positions.push(pos + 1 + offset);
        }
      });
      const haystack = text.toLowerCase(),
        query = find.toLowerCase();
      let start = 0,
        at: number;
      while ((at = haystack.indexOf(query, start)) >= 0) {
        list.push({
          from: positions[at],
          to: positions[at + find.length - 1] + 1,
        });
        start = at + find.length;
      }
      return false;
    });
    return list;
  }
  const found = matches();
  function findNext() {
    const next = matches();
    if (!next.length || !editor) return message("No matching text found.");
    const index = matchIndex % next.length;
    editor.chain().focus().setTextSelection(next[index]).scrollIntoView().run();
    setMatchIndex(index + 1);
  }
  async function clipboard(kind: "copy" | "cut" | "paste") {
    if (!editor) return;
    try {
      if (kind === "paste") {
        const text = await navigator.clipboard.readText();
        editor
          .chain()
          .focus()
          .insertContent(
            text
              .split("\n")
              .map((line) => ({
                type: "paragraph",
                content: line ? [{ type: "text", text: line }] : [],
              })),
          )
          .run();
      } else {
        const { from, to } = editor.state.selection;
        if (from === to) return message("Select text first.");
        await navigator.clipboard.writeText(
          editor.state.doc.textBetween(from, to, "\n"),
        );
        if (kind === "cut")
          editor.chain().focus().deleteRange({ from, to }).run();
      }
    } catch {
      message(
        `Your browser blocked ${kind}. Use the keyboard shortcut: Ctrl/Cmd+${kind === "copy" ? "C" : kind === "cut" ? "X" : "V"}.`,
      );
    }
  }
  return (
    <div className="writer-ribbon">
      <div
        className="writer-ribbon-tabs"
        role="tablist"
        aria-label="Editor tools"
      >
        {["Home", "Insert", "Review", "View"].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        <span>Tools for your next great story</span>
      </div>
      <div
        className="writer-ribbon-panel"
        role="toolbar"
        aria-label={`${tab} formatting tools`}
      >
        {tab === "Home" && (
          <>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                {tool("Paste", "▤", () => void clipboard("paste"))}
                {tool("Cut", "Cut", () => void clipboard("cut"))}
                {tool("Copy", "Copy", () => void clipboard("copy"))}
                {tool(
                  "Format painter",
                  painter ? "Apply format" : "Format painter",
                  () => {
                    if (!editor) return;
                    if (!painter) {
                      setPainter(
                        editor.state.selection.$from
                          .marks()
                          .map((m) => ({ type: m.type.name, attrs: m.attrs })),
                      );
                      message(
                        "Select the destination text, then press Apply format.",
                      );
                    } else {
                      const chain = editor.chain().focus().unsetAllMarks();
                      for (const m of painter) chain.setMark(m.type, m.attrs);
                      chain.run();
                      setPainter(null);
                    }
                  },
                  !!painter,
                )}
              </div>
              <small>Clipboard</small>
            </div>
            <div className="ribbon-group font-group">
              <div className="ribbon-controls">
                <select
                  aria-label="Font family"
                  disabled={blocked}
                  value={
                    editor?.getAttributes("textStyle").fontFamily || "Georgia"
                  }
                  onChange={(e) =>
                    editor!.chain().focus().setFontFamily(e.target.value).run()
                  }
                >
                  {STORY_FONTS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                <select
                  aria-label="Font size"
                  disabled={blocked}
                  value={editor?.getAttributes("textStyle").fontSize || "20px"}
                  onChange={(e) =>
                    editor!.chain().focus().setFontSize(e.target.value).run()
                  }
                >
                  {STORY_SIZES.map((f) => (
                    <option key={f} value={f}>
                      {parseInt(f)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ribbon-controls">
                {tool(
                  "Bold",
                  "B",
                  () => editor!.chain().focus().toggleBold().run(),
                  editor?.isActive("bold"),
                )}
                {tool(
                  "Italic",
                  "I",
                  () => editor!.chain().focus().toggleItalic().run(),
                  editor?.isActive("italic"),
                )}
                {tool(
                  "Underline",
                  "U",
                  () => editor!.chain().focus().toggleUnderline().run(),
                  editor?.isActive("underline"),
                )}
                {tool(
                  "Strikethrough",
                  "S̶",
                  () => editor!.chain().focus().toggleStrike().run(),
                  editor?.isActive("strike"),
                )}
                {tool(
                  "Subscript",
                  "x₂",
                  () => editor!.chain().focus().toggleSubscript().run(),
                  editor?.isActive("subscript"),
                )}
                {tool(
                  "Superscript",
                  "x²",
                  () => editor!.chain().focus().toggleSuperscript().run(),
                  editor?.isActive("superscript"),
                )}
                <label className="ribbon-color" title="Text color">
                  A
                  <input
                    aria-label="Text color"
                    type="color"
                    disabled={blocked}
                    value={
                      editor?.getAttributes("textStyle").color || "#242424"
                    }
                    onChange={(e) =>
                      editor!.chain().focus().setColor(e.target.value).run()
                    }
                  />
                </label>
                {tool(
                  "Highlight",
                  "▰",
                  () =>
                    editor!
                      .chain()
                      .focus()
                      .toggleHighlight({ color: "#fff1ad" })
                      .run(),
                  editor?.isActive("highlight"),
                )}
                {tool("Clear formatting", "A×", () =>
                  editor!.chain().focus().unsetAllMarks().clearNodes().run(),
                )}
              </div>
              <small>Font</small>
            </div>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                {tool(
                  "Bulleted list",
                  "• ≡",
                  () => editor!.chain().focus().toggleBulletList().run(),
                  editor?.isActive("bulletList"),
                )}
                {tool(
                  "Numbered list",
                  "1. ≡",
                  () => editor!.chain().focus().toggleOrderedList().run(),
                  editor?.isActive("orderedList"),
                )}
                {tool("Decrease indent", "←≡", () => {
                  if (editor?.isActive("listItem"))
                    editor.chain().focus().liftListItem("listItem").run();
                  else {
                    const type = editor!.isActive("heading")
                      ? "heading"
                      : "paragraph";
                    editor!
                      .chain()
                      .focus()
                      .updateAttributes(type, {
                        indent: Math.max(
                          0,
                          (editor!.getAttributes(type).indent || 0) - 1,
                        ),
                      })
                      .run();
                  }
                })}
                {tool("Increase indent", "≡→", () => {
                  if (editor?.isActive("listItem"))
                    editor.chain().focus().sinkListItem("listItem").run();
                  else {
                    const type = editor!.isActive("heading")
                      ? "heading"
                      : "paragraph";
                    editor!
                      .chain()
                      .focus()
                      .updateAttributes(type, {
                        indent: Math.min(
                          5,
                          (editor!.getAttributes(type).indent || 0) + 1,
                        ),
                      })
                      .run();
                  }
                })}
              </div>
              <div className="ribbon-controls">
                {["left", "center", "right", "justify"].map((align, i) =>
                  tool(
                    `Align ${align}`,
                    ["≡", "☰", "≡", "▤"][i],
                    () => editor!.chain().focus().setTextAlign(align).run(),
                    editor?.isActive({ textAlign: align }),
                  ),
                )}
                <select
                  aria-label="Line spacing"
                  disabled={blocked}
                  value={editor?.getAttributes("textStyle").lineHeight || "1.8"}
                  onChange={(e) =>
                    editor!.chain().focus().setLineHeight(e.target.value).run()
                  }
                >
                  {STORY_LINE_HEIGHTS.map((h) => (
                    <option value={h} key={h}>
                      ↕ {h}
                    </option>
                  ))}
                </select>
              </div>
              <small>Paragraph</small>
            </div>
            <div className="ribbon-group styles-group">
              <div className="ribbon-controls">
                {tool(
                  "Paragraph",
                  "Normal",
                  () => editor!.chain().focus().setParagraph().run(),
                  editor?.isActive("paragraph"),
                )}
                {tool(
                  "Heading 2",
                  "Heading 2",
                  () =>
                    editor!.chain().focus().toggleHeading({ level: 2 }).run(),
                  editor?.isActive("heading", { level: 2 }),
                )}
                {tool(
                  "Heading 3",
                  "Heading 3",
                  () =>
                    editor!.chain().focus().toggleHeading({ level: 3 }).run(),
                  editor?.isActive("heading", { level: 3 }),
                )}
                {tool(
                  "Quote",
                  "Quote",
                  () => editor!.chain().focus().toggleBlockquote().run(),
                  editor?.isActive("blockquote"),
                )}
              </div>
              <small>Styles</small>
            </div>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                {tool(
                  "Undo",
                  "↶",
                  () => editor!.chain().focus().undo().run(),
                  undefined,
                  !editor?.can().undo(),
                )}
                {tool(
                  "Redo",
                  "↷",
                  () => editor!.chain().focus().redo().run(),
                  undefined,
                  !editor?.can().redo(),
                )}
                {tool("Find and replace", "Find", () => setFindOpen(!findOpen))}
                {tool("Select all", "Select all", () =>
                  editor!.chain().focus().selectAll().run(),
                )}
              </div>
              <small>Editing</small>
            </div>
          </>
        )}
        {tab === "Insert" && (
          <>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                {tool("Image", "Image", image)}
                {tool("Insert link", "Link", () => {
                  setLink(editor?.getAttributes("link").href || "");
                  setLinkError("");
                })}
                {tool(
                  "Remove link",
                  "Unlink",
                  () =>
                    editor!
                      .chain()
                      .focus()
                      .extendMarkRange("link")
                      .unsetLink()
                      .run(),
                  undefined,
                  !editor?.isActive("link"),
                )}
                {tool("Divider", "Divider", () =>
                  editor!.chain().focus().setHorizontalRule().run(),
                )}
                {tool(
                  "Code block",
                  "Code block",
                  () => editor!.chain().focus().toggleCodeBlock().run(),
                  editor?.isActive("codeBlock"),
                )}
                {tool(
                  "Inline code",
                  "Inline code",
                  () => editor!.chain().focus().toggleCode().run(),
                  editor?.isActive("code"),
                )}
              </div>
              <small>Story elements</small>
            </div>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                {tool("Insert table", "Table 3 × 3", () =>
                  editor!
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run(),
                )}
                {tool(
                  "Add row",
                  "+ Row",
                  () => editor!.chain().focus().addRowAfter().run(),
                  undefined,
                  !editor?.isActive("table"),
                )}
                {tool(
                  "Add column",
                  "+ Column",
                  () => editor!.chain().focus().addColumnAfter().run(),
                  undefined,
                  !editor?.isActive("table"),
                )}
                {tool(
                  "Delete row",
                  "− Row",
                  () => editor!.chain().focus().deleteRow().run(),
                  undefined,
                  !editor?.isActive("table"),
                )}
                {tool(
                  "Delete column",
                  "− Column",
                  () => editor!.chain().focus().deleteColumn().run(),
                  undefined,
                  !editor?.isActive("table"),
                )}
                {tool(
                  "Delete table",
                  "Remove table",
                  () => editor!.chain().focus().deleteTable().run(),
                  undefined,
                  !editor?.isActive("table"),
                )}
              </div>
              <small>Tables</small>
            </div>
          </>
        )}
        {tab === "Review" && (
          <div className="ribbon-group">
            <div className="ribbon-controls">
              {tool("Find and replace", "Find & replace", () =>
                setFindOpen(!findOpen),
              )}
              <button type="button" onClick={history}>
                Revision history
              </button>
              <span className="ribbon-hint">
                Browser spellcheck is enabled. Ctrl/Cmd+Z to undo.
              </span>
            </div>
            <small>Review your story</small>
          </div>
        )}
        {tab === "View" && (
          <div className="ribbon-group">
            <div className="ribbon-controls">
              <button type="button" onClick={preview}>
                Reading preview
              </button>
              <button type="button" onClick={focus}>
                Focus mode
              </button>
              <button type="button" onClick={() => window.print()}>
                Print / Save PDF
              </button>
            </div>
            <small>Your writing environment</small>
          </div>
        )}
      </div>
      {findOpen && (
        <div className="writer-find-bar">
          <input
            aria-label="Find text"
            value={find}
            onChange={(e) => {
              setFind(e.target.value);
              setMatchIndex(0);
            }}
            placeholder="Find text"
          />
          <input
            aria-label="Replace with"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Replace with"
          />
          <span>{found.length} matches</span>
          <button disabled={blocked || !found.length} onClick={findNext}>
            Find next
          </button>
          <button
            disabled={blocked || !found.length}
            onClick={() => {
              const all = matches();
              if (!editor || !all.length) return;
              const tr = editor.state.tr;
              for (const m of all.reverse())
                tr.insertText(replace, m.from, m.to);
              editor.view.dispatch(tr);
              message(
                `Replaced ${all.length} occurrence${all.length === 1 ? "" : "s"}.`,
              );
            }}
          >
            Replace all
          </button>
          <button
            aria-label="Close find and replace"
            onClick={() => setFindOpen(false)}
          >
            ×
          </button>
        </div>
      )}
      {link !== null && (
        <Modal title="Insert link" onClose={() => setLink(null)}>
          <form
            className="writer-profile-form"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const url = new URL(link);
                if (
                  !["https:", "http:"].includes(url.protocol) ||
                  url.username ||
                  url.password ||
                  link.length > 1200
                )
                  throw new Error();
                editor!
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href: url.href })
                  .run();
                setLink(null);
              } catch {
                setLinkError(
                  "Enter a valid HTTP or HTTPS address without credentials.",
                );
              }
            }}
          >
            <h2>Give your words a connection.</h2>
            <label>
              Link address
              <input
                type="url"
                autoFocus
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://"
                required
              />
            </label>
            {linkError && <p role="alert">{linkError}</p>}
            <button className="btn dark">Insert link</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
