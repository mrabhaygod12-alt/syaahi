"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { requestJson } from "@/lib/http-client";
import { textDocument, type RichNode } from "@/lib/writing/document";
import StoryDocument from "./StoryDocument";
interface Story {
  id: string;
  title: string;
  summary: string;
  body: string;
  document?: RichNode;
  tags: string[];
  status: string;
  updatedAt: string;
  reviewNote?: string;
  versions?: Array<{
    title: string;
    summary: string;
    body: string;
    document?: RichNode;
    tags: string[];
    savedAt: string;
  }>;
}
export default function WriterStudio() {
  const [stories, setStories] = useState<Story[]>([]),
    [active, setActive] = useState<Story | null>(null);
  const [title, setTitle] = useState(""),
    [summary, setSummary] = useState(""),
    [tags, setTags] = useState("");
  const [document, setDocument] = useState<RichNode>(textDocument(""));
  const [autosavePaused, setAutosavePaused] = useState(false),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useState("Loading your drafts…");
  const [preview, setPreview] = useState(false),
    [alt, setAlt] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [imageDialog, setImageDialog] = useState(false),
    [guest, setGuest] = useState(false);
  const activeRef = useRef<Story | null>(null),
    saving = useRef(false),
    revision = useRef(0);
  const locked =
    !!active && !["draft", "changes_requested"].includes(active.status);
  function edited() {
    revision.current++;
    setDirty(true);
    setAutosavePaused(false);
    setMessage("Changes pending save.");
  }
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false },
      }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: textDocument(""),
    editorProps: {
      attributes: {
        "aria-label": "Story editor",
        role: "textbox",
        "aria-multiline": "true",
        class: "writer-content",
      },
    },
    onUpdate: ({ editor }) => {
      setDocument(editor.getJSON() as RichNode);
      edited();
    },
  });
  function open(story: Story | null) {
    if (
      saving.current ||
      (dirty && !window.confirm("Leave the unsaved changes in this draft?"))
    )
      return;
    activeRef.current = story;
    setActive(story);
    setTitle(story?.title || "");
    setSummary(story?.summary || "");
    setTags(story?.tags.join(", ") || "");
    const next = story?.document || textDocument(story?.body || "");
    setDocument(next);
    editor?.commands.setContent(next, { emitUpdate: false });
    setDirty(false);
    setPreview(false);
    setMessage(story ? "Draft opened." : "Start a new story.");
  }
  useEffect(() => {
    let alive = true;
    requestJson("/api/stories")
      .then(({ response, data }) => {
        if (!alive) return;
        if (response.status === 401) {
          setGuest(true);
          setMessage("Sign in to use Writer Studio.");
          return;
        }
        if (!response.ok) throw new Error(data.error);
        setStories(data.stories || []);
        setMessage("");
        const id = new URLSearchParams(location.search).get("draft"),
          found = data.stories?.find((s: Story) => s.id === id);
        if (found) {
          activeRef.current = found;
          setActive(found);
          setTitle(found.title);
          setSummary(found.summary);
          setTags(found.tags.join(", "));
          const next = found.document || textDocument(found.body);
          setDocument(next);
          editor?.commands.setContent(next, { emitUpdate: false });
        }
      })
      .catch((e) => alive && setMessage(e.message));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (editor && activeRef.current)
      editor.commands.setContent(
        activeRef.current.document || textDocument(activeRef.current.body),
        { emitUpdate: false },
      );
  }, [editor, active?.id]);
  useEffect(() => {
    editor?.setEditable(!locked && !busy, false);
  }, [editor, locked, busy]);
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  async function save(action: "save" | "submit") {
    if (saving.current || locked || !title.trim()) return;
    saving.current = true;
    setBusy(true);
    const savingRevision = revision.current;
    try {
      const { response, data } = await requestJson("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeRef.current?.id,
          expectedUpdatedAt: activeRef.current?.updatedAt,
          title,
          summary,
          document,
          body: "",
          tags: tags.split(","),
          action,
        }),
      });
      if (!response.ok)
        throw new Error(data.error || "Draft could not be saved.");
      const story = data.story as Story;
      activeRef.current = story;
      setActive(story);
      setStories((old) => [story, ...old.filter((s) => s.id !== story.id)]);
      if (revision.current === savingRevision) setDirty(false);
      setMessage(
        action === "submit"
          ? "Submitted for review. Your story stays private until an editor publishes it."
          : "Saved to your account.",
      );
    } catch (e) {
      setAutosavePaused(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Save failed. Your changes remain in the editor.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (autosavePaused || !dirty || !title.trim() || locked || busy) return;
    const timer = setTimeout(() => void saveRef.current("save"), 2500);
    return () => clearTimeout(timer);
  }, [title, summary, tags, document, dirty, locked, busy, autosavePaused]);
  async function insertImage() {
    if (!file || !alt.trim() || !editor) return;
    setBusy(true);
    saving.current = true;
    try {
      const form = new FormData();
      form.set("image", file);
      form.set("alt", alt);
      const { response, data } = await requestJson("/api/writing/images", {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error(data.error);
      editor.chain().focus().setImage({ src: data.url, alt: data.alt }).run();
      setImageDialog(false);
      setFile(null);
      setAlt("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const button = (label: string, run: () => unknown, pressed = false) => (
    <button
      type="button"
      disabled={!editor || locked || busy || preview}
      aria-pressed={pressed}
      onClick={() => run()}
    >
      {label}
    </button>
  );
  if (guest)
    return (
      <div className="card">
        <p>{message}</p>
        <a className="btn dark" href="/login?next=/write">
          Log in
        </a>
      </div>
    );
  return (
    <div className="writer-shell">
      <aside className="writer-drafts">
        <a href="/writer">Writer dashboard</a>
        <h2>Stories</h2>
        <button className="btn dark" disabled={busy} onClick={() => open(null)}>
          New story
        </button>
        {stories.map((s) => (
          <button
            key={s.id}
            disabled={busy}
            className="writer-draft"
            aria-current={active?.id === s.id ? "page" : undefined}
            onClick={() => open(s)}
          >
            <strong>{s.title}</strong>
            <small>
              {s.status.replaceAll("_", " ")} ·{" "}
              {new Date(s.updatedAt).toLocaleDateString()}
            </small>
          </button>
        ))}
        {!stories.length && (
          <p className="small">Your saved drafts will appear here.</p>
        )}
      </aside>
      <section className="writer-page">
        <div className="writer-topline">
          <span>
            {locked
              ? active?.status.replaceAll("_", " ")
              : dirty
                ? "Unsaved changes"
                : "Private draft"}
          </span>
          <button className="btn light" onClick={() => setPreview(!preview)}>
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
        <label className="sr-only" htmlFor="story-title">
          Story title
        </label>
        <input
          id="story-title"
          className="writer-title"
          placeholder="Title"
          value={title}
          maxLength={140}
          disabled={locked || busy}
          onChange={(e) => {
            setTitle(e.target.value);
            edited();
          }}
        />
        <label className="sr-only" htmlFor="story-summary">
          Short summary
        </label>
        <textarea
          id="story-summary"
          className="writer-summary"
          rows={2}
          value={summary}
          maxLength={320}
          placeholder="Tell readers what they will learn"
          disabled={locked || busy}
          onChange={(e) => {
            setSummary(e.target.value);
            edited();
          }}
        />
        {preview ? (
          <StoryDocument document={document} fallback="" />
        ) : (
          <>
            <div
              className="writer-toolbar"
              role="toolbar"
              aria-label="Text formatting"
            >
              {button(
                "Paragraph",
                () => editor!.chain().focus().setParagraph().run(),
                editor?.isActive("paragraph"),
              )}
              {button(
                "Heading 2",
                () => editor!.chain().focus().toggleHeading({ level: 2 }).run(),
                editor?.isActive("heading", { level: 2 }),
              )}
              {button("Heading 3", () =>
                editor!.chain().focus().toggleHeading({ level: 3 }).run(),
              )}
              {button(
                "Bold",
                () => editor!.chain().focus().toggleBold().run(),
                editor?.isActive("bold"),
              )}
              {button("Italic", () =>
                editor!.chain().focus().toggleItalic().run(),
              )}
              {button("Underline", () =>
                editor!.chain().focus().toggleUnderline().run(),
              )}
              {button("Bullets", () =>
                editor!.chain().focus().toggleBulletList().run(),
              )}
              {button("Numbered list", () =>
                editor!.chain().focus().toggleOrderedList().run(),
              )}
              {button("Quote", () =>
                editor!.chain().focus().toggleBlockquote().run(),
              )}
              {button("Link", () => {
                const href = window.prompt("Enter an HTTPS link");
                if (href && /^https?:\/\//i.test(href))
                  editor!.chain().focus().setLink({ href }).run();
              })}
              {button("Image", () => setImageDialog(true))}
              {button("Undo", () => editor!.chain().focus().undo().run())}
              {button("Redo", () => editor!.chain().focus().redo().run())}
            </div>
            <EditorContent editor={editor} />
            {!editor && <p role="status">Opening editor…</p>}
          </>
        )}
        {imageDialog && (
          <div
            className="writer-image-form"
            role="group"
            aria-label="Insert image"
          >
            <label>
              Image (JPEG, PNG or WebP, up to 4 MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <label>
              Describe the image for readers
              <input
                value={alt}
                maxLength={300}
                onChange={(e) => setAlt(e.target.value)}
              />
            </label>
            <button
              className="btn dark"
              disabled={busy || !file || !alt.trim()}
              onClick={() => void insertImage()}
            >
              Upload and insert
            </button>
            <button className="btn light" onClick={() => setImageDialog(false)}>
              Cancel
            </button>
          </div>
        )}
        <label>
          Topics (up to five)
          <input
            value={tags}
            maxLength={180}
            disabled={locked || busy}
            placeholder="Computer science, revision"
            onChange={(e) => {
              setTags(e.target.value);
              edited();
            }}
          />
        </label>
        <p className="small">
          {editor?.getText().length || 0} characters. Autosaves after you add a
          title. Images stay private until publication.
        </p>
        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}
        {active?.reviewNote && (
          <p className="card">
            <strong>Editorial feedback</strong>
            <br />
            {active.reviewNote}
          </p>
        )}
        {!locked && (
          <div className="hero-actions">
            <button
              className="btn light"
              disabled={busy || !title.trim()}
              onClick={() => void save("save")}
            >
              Save draft
            </button>
            <button
              className="btn dark"
              disabled={busy || !title.trim()}
              onClick={() => {
                if (window.confirm("Submit this version for editorial review?"))
                  void save("submit");
              }}
            >
              Submit for review
            </button>
          </div>
        )}
        {!!active?.versions?.length && (
          <details>
            <summary>Version history ({active.versions.length})</summary>
            {active.versions
              .slice()
              .reverse()
              .map((v, i) => (
                <button
                  key={i}
                  className="btn light"
                  disabled={locked || busy}
                  onClick={() => {
                    setTitle(v.title);
                    setSummary(v.summary);
                    setTags(v.tags.join(", "));
                    const next = v.document || textDocument(v.body);
                    setDocument(next);
                    editor?.commands.setContent(next, { emitUpdate: false });
                    edited();
                  }}
                >
                  Restore {new Date(v.savedAt).toLocaleString()}
                </button>
              ))}
          </details>
        )}
      </section>
    </div>
  );
}
