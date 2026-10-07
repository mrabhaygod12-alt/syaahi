"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import { requestJson } from "@/lib/http-client";
import {
  textDocument,
  documentText,
  type RichNode,
} from "@/lib/writing/document";
import type { Story } from "@/lib/writing/stories";
import StoryDocument from "./StoryDocument";
import WriterShell from "./writer/WriterShell";
import WriterRibbon from "./writer/WriterRibbon";
import {
  ParagraphIndent,
  ArticleDesign,
  Equation,
  Video,
  Contents,
} from "./writer/editor-extensions";
import { articleStyles, normalizeDesign } from "@/lib/writing/design";
import Modal from "./Modal";
import WriterDiscovery from "./writer/WriterDiscovery";
function StudioContent() {
  const [active, setActive] = useState<Story | null>(null),
    [title, setTitle] = useState(""),
    [summary, setSummary] = useState(""),
    [canonicalUrl, setCanonicalUrl] = useState(""),
    [tags, setTags] = useState("");
  const [document, setDocument] = useState<RichNode>(textDocument("")),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [paused, setPaused] = useState(false),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(""),
    [saveError, setSaveError] = useState(false),
    [preview, setPreview] = useState(false),
    [focus, setFocus] = useState(false),
    [tools, setTools] = useState(true),
    [dialog, setDialog] = useState<
      "image" | "publish" | "history" | "discovery" | null
    >(null),
    [file, setFile] = useState<File | null>(null),
    [alt, setAlt] = useState(""),
    [caption, setCaption] = useState("");
  const activeRef = useRef<Story | null>(null),
    saving = useRef(false),
    revision = useRef(0),
    initialized = useRef(false),
    readyDocument = useRef<RichNode | null>(null);
  const locked =
    !!active && !["draft", "changes_requested"].includes(active.status);
  function edited() {
    revision.current++;
    setDirty(true);
    setPaused(false);
    setSaveError(false);
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
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TableKit,
      Placeholder.configure({ placeholder: "Tell your story…" }),
      ParagraphIndent,
      ArticleDesign,
      Equation,
      Video,
      Contents,
    ],
    content: textDocument(""),
    editorProps: {
      attributes: {
        "aria-label": "Story editor",
        role: "textbox",
        "aria-multiline": "true",
        class: "writer-content",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      if (!initialized.current) return;
      setDocument(editor.getJSON() as RichNode);
      edited();
    },
  });
  const load = () => {
    setLoadError("");
    const requestedId = new URLSearchParams(location.search).get("draft");
    requestJson(
      "/api/stories" +
        (requestedId ? `?id=${encodeURIComponent(requestedId)}` : ""),
    )
      .then(({ response, data }) => {
        if (!response.ok)
          throw new Error(data.error || "Unable to load draft.");
        const id = new URLSearchParams(location.search).get("draft");
        const story = id ? data.stories.find((s: Story) => s.id === id) : null;
        if (id && !story)
          throw new Error(
            "This draft could not be found. Open it from Your stories.",
          );
        activeRef.current = story;
        setActive(story);
        setTitle(story?.title || "");
        setSummary(story?.summary || "");
        setCanonicalUrl(story?.canonicalUrl || "");
        setTags(story?.tags.join(", ") || "");
        const nextDocument = story?.document || textDocument(story?.body || "");
        readyDocument.current = nextDocument;
        setDocument(nextDocument);
        setLoaded(true);
      })
      .catch((e) => setLoadError(e.message));
  };
  useEffect(load, []);
  useEffect(() => {
    if (editor && loaded && !initialized.current) {
      editor.commands.setContent(readyDocument.current!, { emitUpdate: false });
      initialized.current = true;
    }
  }, [editor, loaded]);
  useEffect(() => {
    editor?.setEditable(loaded && !locked && !preview && !submitting, false);
  }, [editor, loaded, locked, preview, submitting]);
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      if (dirty || saving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  async function save(action: "save" | "submit") {
    if (saving.current || locked || !loaded) return;
    saving.current = true;
    setBusy(true);
    setSaveError(false);
    setMessage("Saving…");
    if (action === "submit") setSubmitting(true);
    const savingRevision = revision.current;
    try {
      const { response, data } = await requestJson("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeRef.current?.id,
          expectedUpdatedAt: activeRef.current?.updatedAt,
          title: title.trim() || "Untitled story",
          summary,
          canonicalUrl,
          document: editor?.getJSON() || document,
          body: "",
          tags: tags.split(","),
          action,
        }),
      });
      if (!response.ok)
        throw new Error(data.error || "Draft could not be saved.");
      activeRef.current = data.story;
      setActive(data.story);
      if (revision.current === savingRevision) setDirty(false);
      if (!new URLSearchParams(location.search).get("draft"))
        window.history.replaceState(null, "", `/write?draft=${data.story.id}`);
      setMessage(
        action === "submit"
          ? "Submitted for review. Your story remains private until approved."
          : revision.current === savingRevision
            ? "Saved to your account."
            : "Saving your latest changes next…",
      );
      if (action === "submit") setDialog(null);
    } catch (e) {
      setPaused(true);
      setSaveError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Save failed. Your changes remain in the editor.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
      setSubmitting(false);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (
      !loaded ||
      paused ||
      !dirty ||
      locked ||
      busy ||
      (!title.trim() && !documentText(document).trim())
    )
      return;
    const timer = setTimeout(() => void saveRef.current("save"), 2500);
    return () => clearTimeout(timer);
  }, [
    title,
    summary,
    canonicalUrl,
    tags,
    document,
    dirty,
    locked,
    busy,
    paused,
    loaded,
  ]);
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
      editor
        .chain()
        .focus()
        .setImage({ src: data.url, alt: data.alt, title: caption.trim() })
        .run();
      setDialog(null);
      setFile(null);
      setAlt("");
      setCaption("");
    } catch (e) {
      setSaveError(true);
      setMessage(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function exportDraft() {
    const blob = new Blob(
      [
        JSON.stringify(
          { title, summary, document, tags: tags.split(",") },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${title || "draft"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const words = documentText(document)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (loadError)
    return (
      <div className="writer-gate">
        <h1>Your draft could not open.</h1>
        <p role="alert">{loadError}</p>
        <button className="btn light" onClick={load}>
          Try again
        </button>{" "}
        <a href="/writer/stories">Back to stories</a>
      </div>
    );
  return (
    <div className={`writer-studio${focus ? " focus-mode" : ""}`}>
      <div className="writer-editor-actions">
        <a href="/writer/stories">← Your stories</a>
        <span className="writer-save-status" role="status">
          {busy
            ? "Saving…"
            : dirty
              ? "Unsaved changes"
              : active
                ? "Saved"
                : "Private draft"}
        </span>
        <button className="writer-text-button" onClick={() => setTools(!tools)}>
          {tools ? "Hide tools" : "Show tools"}
        </button>
        <button className="writer-text-button" onClick={() => setFocus(!focus)}>
          {focus ? "Exit focus" : "Focus"}
        </button>
        <button className="btn light" onClick={() => setPreview(!preview)}>
          {preview ? "Edit" : "Preview"}
        </button>
        <button
          className="writer-text-button"
          disabled={!active || locked || busy || dirty || submitting}
          onClick={() => setDialog("discovery")}
        >
          Discovery
        </button>
        <button
          className="btn dark"
          disabled={busy || locked || !loaded || !title.trim()}
          onClick={() => setDialog("publish")}
        >
          Publish
        </button>
        <details className="writer-more">
          <summary aria-label="More story actions">•••</summary>
          <div>
            <button
              disabled={busy || locked || !loaded}
              onClick={() => void save("save")}
            >
              Save draft
            </button>
            <button onClick={() => setDialog("history")}>
              Revision history
            </button>
            <button onClick={exportDraft}>Download draft</button>
            <button onClick={() => window.print()}>Print / Save PDF</button>
          </div>
        </details>
      </div>
      {tools && !preview && (
        <WriterRibbon
          editor={editor}
          disabled={!loaded || busy || locked}
          image={() => setDialog("image")}
          history={() => setDialog("history")}
          preview={() => setPreview(true)}
          focus={() => setFocus(!focus)}
          message={setMessage}
        />
      )}
      <article
        className={`writer-canvas article-design theme-${normalizeDesign(document.attrs).theme} border-${normalizeDesign(document.attrs).pageBorder}`}
        style={articleStyles(document.attrs)}
      >
        {!locked && !preview && loaded && (
          <details className="writer-block-insert">
            <summary aria-label="Add story element">+</summary>
            <div>
              <button disabled={busy} onClick={() => setDialog("image")}>
                Image
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  editor?.chain().focus().setHorizontalRule().run()
                }
              >
                Divider
              </button>
              <button
                disabled={busy}
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              >
                Code block
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  editor
                    ?.chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              >
                Table
              </button>
            </div>
          </details>
        )}
        <label className="sr-only" htmlFor="story-title">
          Story title
        </label>
        <input
          id="story-title"
          className="writer-title"
          placeholder="Title"
          value={title}
          maxLength={140}
          disabled={!loaded || locked || submitting}
          onChange={(e) => {
            setTitle(e.target.value);
            edited();
          }}
        />
        {locked && (
          <p className="writer-review-note">
            {active?.status === "published"
              ? "This story is published."
              : "This story is awaiting editorial review."}{" "}
            {active?.slug && (
              <a href={`/guides/${active.slug}`}>Read published story ↗</a>
            )}
          </p>
        )}
        {preview ? (
          <>
            <p className="writer-preview-summary">{summary}</p>
            <StoryDocument document={document} fallback="" embedded />
          </>
        ) : (
          <EditorContent editor={editor} />
        )}
        {!loaded && <p role="status">Opening your draft…</p>}
        {active?.reviewNote && (
          <p className="writer-review-note">
            <strong>Editorial feedback:</strong> {active.reviewNote}
          </p>
        )}
      </article>
      <div className="writer-editor-status">
        <span>
          {words} words · {Math.max(1, Math.ceil(words / 220))} min read
        </span>
        <p role={saveError ? "alert" : "status"}>
          {message || "Private until you submit for publication."}
        </p>
        {paused && (
          <button disabled={busy} onClick={() => void save("save")}>
            Retry save
          </button>
        )}
      </div>
      {dialog === "discovery" && active && (
        <Modal
          title="Story discovery"
          wide
          onClose={() => {
            if (!submitting) setDialog(null);
          }}
        >
          <WriterDiscovery
            story={active}
            ready={!busy && !dirty && !locked}
            onBusy={setSubmitting}
            onApply={(story) => {
              activeRef.current = story;
              setActive(story);
              setMessage("Approved search metadata saved.");
            }}
          />
        </Modal>
      )}
      {dialog === "publish" && (
        <Modal
          title="Publish your story"
          wide
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          <form
            className="writer-publish-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save("submit");
            }}
          >
            <div>
              <p className="writer-kicker">YOUR STORY, READY FOR READERS</p>
              <h2>Publish your story</h2>
              <div className="writer-publish-preview">
                <h3>{title}</h3>
                <p>{summary || "Add a summary that makes readers curious."}</p>
                <span>
                  {words} words · {Math.max(1, Math.ceil(words / 220))} min read
                </span>
              </div>
            </div>
            <div>
              <label>
                Story preview summary
                <textarea
                  id="story-summary"
                  value={summary}
                  maxLength={320}
                  rows={4}
                  disabled={busy}
                  onChange={(e) => {
                    setSummary(e.target.value);
                    edited();
                  }}
                />
                <small>{summary.length}/320</small>
              </label>
              <label>
                Original article / canonical URL (optional)
                <input
                  type="url"
                  placeholder="https://your-site.example/original-article"
                  maxLength={2000}
                  value={canonicalUrl}
                  onChange={(e) => {
                    setCanonicalUrl(e.target.value);
                    edited();
                  }}
                />
                <small>
                  Use this when cross-posting an article you own. The public
                  page points search engines to that original URL.
                </small>
              </label>
              <label>
                Topics (up to five)
                <input
                  value={tags}
                  maxLength={180}
                  placeholder="Technology, learning, personal growth"
                  disabled={busy}
                  onChange={(e) => {
                    setTags(e.target.value);
                    edited();
                  }}
                />
              </label>
              <p className="writer-fine-print">
                Syaahi reviews submissions before publication. Your story and
                images stay private until an editor approves them. After
                submission, editing is paused during review.
              </p>
              {saveError && <p role="alert">{message}</p>}
              <button
                className="btn dark"
                disabled={
                  busy ||
                  title.trim().length < 5 ||
                  documentText(document).trim().length < 80
                }
              >
                {busy ? "Submitting…" : "Submit for publication"}
              </button>
              <p className="writer-fine-print">
                A title of at least 5 characters and a story of at least 80
                characters are required.
              </p>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "image" && (
        <Modal
          title="Insert image"
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          <form
            className="writer-profile-form"
            onSubmit={(e) => {
              e.preventDefault();
              void insertImage();
            }}
          >
            <h2>A picture adds perspective.</h2>
            <label>
              Image (JPEG, PNG or WebP, up to 4 MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </label>
            <label>
              Describe the image for readers
              <input
                value={alt}
                maxLength={300}
                disabled={busy}
                onChange={(e) => setAlt(e.target.value)}
                required
              />
            </label>
            <label>
              Caption (optional)
              <input
                value={caption}
                maxLength={300}
                disabled={busy}
                onChange={(e) => setCaption(e.target.value)}
              />
            </label>
            {saveError && <p role="alert">{message}</p>}
            <button
              className="btn dark"
              disabled={busy || !file || !alt.trim()}
            >
              {busy ? "Uploading…" : "Upload and insert"}
            </button>
          </form>
        </Modal>
      )}
      {dialog === "history" && (
        <Modal title="Revision history" onClose={() => setDialog(null)}>
          <h2>Revision history</h2>
          <p className="writer-fine-print">
            The last ten saved versions. Restoring creates an editable draft
            change; it saves automatically.
          </p>
          {!active?.versions?.length && (
            <p>No previous versions yet. Save a draft to get started.</p>
          )}
          <div className="writer-history">
            {active?.versions
              ?.slice()
              .reverse()
              .map((v, i) => (
                <div key={i}>
                  <span>
                    <strong>{v.title}</strong>
                    <small>{new Date(v.savedAt).toLocaleString("en-IN")}</small>
                  </span>
                  <button
                    className="btn light"
                    disabled={busy || locked}
                    onClick={() => {
                      if (
                        dirty &&
                        !window.confirm(
                          "Replace your current unsaved text with this revision?",
                        )
                      )
                        return;
                      setTitle(v.title);
                      setSummary(v.summary);
                      setTags(v.tags.join(", "));
                      const next = v.document || textDocument(v.body);
                      setDocument(next);
                      editor?.commands.setContent(next, { emitUpdate: false });
                      edited();
                      setDialog(null);
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function WriterStudio() {
  return (
    <WriterShell editor>
      <StudioContent />
    </WriterShell>
  );
}
