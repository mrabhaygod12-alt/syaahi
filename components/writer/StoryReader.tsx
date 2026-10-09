"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "@/components/WorkspaceProvider";
import type { ReaderRecord } from "@/lib/writing/social";
export default function StoryReader({
  slug,
  children,
  afterContent,
}: {
  slug: string;
  children: React.ReactNode;
  afterContent?: React.ReactNode;
}) {
  const { user, loading } = useAccount(),
    [reader, setReader] = useState<ReaderRecord | null>(null),
    [responses, setResponses] = useState<any[]>([]),
    [response, setResponse] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [responsesLoading, setResponsesLoading] = useState(true),
    [responsesError, setResponsesError] = useState(""),
    [progress, setProgress] = useState(0);
  const responseRequest = useRef<AbortController | null>(null),
    mutation = useRef<AbortController | null>(null),
    readerVersion = useRef(0);
  const content = useRef<HTMLDivElement>(null),
    seconds = useRef(0),
    posting = useRef(""),
    last = useRef(Date.now());
  const identity = useRef(user?.id);
  identity.current = loading ? undefined : user?.id;
  const root = `/api/publications/${encodeURIComponent(slug)}`;
  const currentRoot = useRef(root);
  currentRoot.current = root;
  const load = useCallback(async () => {
    responseRequest.current?.abort();
    const controller = new AbortController();
    responseRequest.current = controller;
    const owner = identity.current;
    setResponsesLoading(true);
    setResponsesError("");
    try {
      const { response, data } = await requestJson(`${root}/responses`, {
        signal: controller.signal,
      });
      if (
        !controller.signal.aborted &&
        identity.current === owner &&
        currentRoot.current === root
      ) {
        if (!response.ok)
          throw new Error(data.error || "Could not load responses.");
        setResponses(data.responses || []);
      }
    } catch (e) {
      if (
        !controller.signal.aborted &&
        identity.current === owner &&
        currentRoot.current === root
      )
        setResponsesError((e as Error).message);
    } finally {
      if (
        !controller.signal.aborted &&
        identity.current === owner &&
        currentRoot.current === root
      )
        setResponsesLoading(false);
    }
  }, [root]);
  useEffect(() => {
    let cancelled = false;
    setReader(null);
    setResponses([]);
    setResponsesLoading(true);
    setResponsesError("");
    setBusy(false);
    setNote("");
    setResponse("");
    setMessage("");
    setError("");
    seconds.current = 0;
    last.current = Date.now();
    posting.current = "";
    if (loading) return;
    void load();
    const start = new AbortController();
    const version = ++readerVersion.current;
    if (user) {
      void requestJson(`${root}/reader`, {
        method: "POST",
        signal: start.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      })
        .then(({ response, data }) => {
          if (response.ok && !cancelled && readerVersion.current === version)
            setReader(data.reader);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      start.abort();
      responseRequest.current?.abort();
      mutation.current?.abort();
      mutation.current = null;
    };
  }, [user?.id, loading, root, load]);
  useEffect(() => {
    const scroll = () => {
      if (!content.current) return;
      const rect = content.current.getBoundingClientRect();
      setProgress(
        Math.max(
          0,
          Math.min(
            1,
            (window.innerHeight - rect.top) / Math.max(rect.height, 1),
          ),
        ),
      );
    };
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    return () => {
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
    };
  }, []);
  const currentProgress = useRef(0);
  currentProgress.current = progress;
  useEffect(() => {
    if (!user || loading) return;
    const owner = user.id;
    const tick = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible" && document.hasFocus())
        seconds.current += Math.min(2, (now - last.current) / 1000);
      last.current = now;
    }, 1000);
    const save = setInterval(() => {
      readerVersion.current++;
      const spent = seconds.current;
      seconds.current = 0;
      void requestJson(`${root}/reader`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "progress",
          fraction: currentProgress.current,
          seconds: Math.min(35, spent),
        }),
      })
        .then(({ response, data }) => {
          if (
            response.ok &&
            identity.current === owner &&
            currentRoot.current === root
          )
            setReader(data.reader);
        })
        .catch(() => {
          if (identity.current === owner && currentRoot.current === root)
            seconds.current += spent;
        });
    }, 15000);
    return () => {
      clearInterval(tick);
      clearInterval(save);
    };
  }, [user?.id, loading, root]);
  async function action(body: any) {
    if (loading || mutation.current) return;
    const owner = user?.id;
    const controller = new AbortController();
    mutation.current = controller;
    readerVersion.current++;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { response, data } = await requestJson(`${root}/reader`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (
        controller.signal.aborted ||
        identity.current !== owner ||
        currentRoot.current !== root
      )
        return;
      if (!response.ok) throw new Error(data.error);
      setReader(data.reader);
      setNote("");
      setMessage("Saved privately to your reading library.");
    } catch (e) {
      if (
        !controller.signal.aborted &&
        identity.current === owner &&
        currentRoot.current === root
      )
        setError((e as Error).message);
    } finally {
      if (mutation.current === controller) {
        mutation.current = null;
        setBusy(false);
      }
    }
  }
  async function highlight() {
    const selection = window.getSelection();
    if (
      !selection?.rangeCount ||
      !content.current?.contains(selection.anchorNode) ||
      !content.current?.contains(selection.focusNode)
    ) {
      setError("Select a passage inside the story first.");
      return;
    }
    await action({ action: "highlight", quote: selection.toString(), note });
  }
  async function post(id?: string) {
    if (loading || mutation.current) return;
    const owner = user?.id;
    const controller = new AbortController();
    mutation.current = controller;
    responseRequest.current?.abort();
    setBusy(true);
    setError("");
    try {
      if (!posting.current) posting.current = crypto.randomUUID();
      const { response: res, data } = await requestJson(`${root}/responses`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          id
            ? { action: "delete", id }
            : { body: response, event: posting.current },
        ),
      });
      if (
        controller.signal.aborted ||
        identity.current !== owner ||
        currentRoot.current !== root
      )
        return;
      if (!res.ok) throw new Error(data.error);
      setResponses(data.responses || []);
      setResponsesLoading(false);
      setResponsesError("");
      setResponse("");
      posting.current = "";
      window.dispatchEvent(
        new CustomEvent("syaahi-story-activity", { detail: slug }),
      );
    } catch (e) {
      if (
        !controller.signal.aborted &&
        identity.current === owner &&
        currentRoot.current === root
      ) {
        setError((e as Error).message);
        void load();
      }
    } finally {
      if (mutation.current === controller) {
        mutation.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <>
      <div
        className="story-reading-progress"
        aria-label={`Story progress ${Math.round(progress * 100)} percent`}
      >
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      {!loading &&
        reader &&
        reader.fraction > 0.05 &&
        reader.fraction < 0.95 && (
          <button
            className="writer-text-button"
            onClick={() => {
              if (content.current) {
                const rect = content.current.getBoundingClientRect();
                window.scrollTo({
                  top:
                    window.scrollY +
                    rect.top +
                    rect.height * reader.fraction -
                    window.innerHeight,
                  behavior: "smooth",
                });
              }
            }}
          >
            Resume at {Math.round(reader.fraction * 100)}%
          </button>
        )}
      <div ref={content} className="reader-story-content">
        {children}
      </div>
      {afterContent}
      {error && (
        <p role="alert" className="writer-review-note">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {user && !loading && (
        <section className="story-private-notes">
          <h2>Your reading notes</h2>
          <p>
            Select a passage in the story, then save it with a private note.
          </p>
          <label>
            Note for selected passage
            <textarea
              disabled={busy}
              value={note}
              maxLength={1000}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button
            className="btn light"
            disabled={busy}
            onClick={() => void highlight()}
          >
            Save selected passage
          </button>
          {reader?.highlights.map((h) => (
            <blockquote key={h.id}>
              <p>{h.quote}</p>
              {h.note && <small>{h.note}</small>}
              <button
                className="writer-text-button"
                disabled={busy}
                onClick={() =>
                  void action({ action: "remove-highlight", id: h.id })
                }
              >
                Remove highlight
              </button>
            </blockquote>
          ))}
          <a
            href={user.workspace === "writer" ? "/writer/reading" : "/reading"}
          >
            Your reading library →
          </a>
        </section>
      )}
      <section id="story-responses" className="story-responses">
        <h2>
          Responses{" "}
          {!responsesLoading && !responsesError && (
            <small>
              {responses.length === 100 ? "100+" : responses.length}
            </small>
          )}
        </h2>
        {loading ? (
          <p role="status">Opening your account…</p>
        ) : user ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void post();
            }}
          >
            <label>
              Your response
              <textarea
                disabled={busy}
                required
                minLength={2}
                maxLength={2000}
                rows={3}
                value={response}
                onChange={(e) => {
                  setResponse(e.target.value);
                  posting.current = "";
                }}
              />
            </label>
            <p>Your name and response will be public.</p>
            <button
              className="btn dark"
              disabled={busy || response.trim().length < 2}
            >
              Post publicly
            </button>
          </form>
        ) : (
          <a href={`/login?next=${encodeURIComponent(`/guides/${slug}`)}`}>
            Sign in to respond
          </a>
        )}
        {responses.map((r) => (
          <article key={r.id}>
            <header>
              <strong>{r.name}</strong>
              <small>{new Date(r.createdAt).toLocaleDateString()}</small>
            </header>
            <p>{r.body}</p>
            {r.canDelete && (
              <button
                className="writer-text-button"
                disabled={busy}
                onClick={() => void post(r.id)}
              >
                Remove response
              </button>
            )}
          </article>
        ))}
        {responsesLoading && <p role="status">Loading responses…</p>}
        {responsesError && (
          <div>
            <p role="alert">{responsesError}</p>
            <button className="btn light" onClick={() => void load()}>
              Retry responses
            </button>
          </div>
        )}
        {!responsesLoading && !responsesError && !responses.length && (
          <p>No responses yet. Share a thoughtful perspective.</p>
        )}
      </section>
    </>
  );
}
