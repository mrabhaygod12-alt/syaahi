"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/http-client";
import type { PinAction, pinWorkspace } from "@/lib/writing/pins";
import { useWriter } from "./WriterShell";
type Pins = Awaited<ReturnType<typeof pinWorkspace>>;
export default function FeaturedStories() {
  const { profile } = useWriter();
  const identity = useRef(profile.owner);
  identity.current = profile.owner;
  const pending = useRef<AbortController | null>(null);
  const [saved, setSaved] = useState<{ owner: string; value: Pins } | null>(
      null,
    ),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState("");
  const data = saved?.owner === profile.owner ? saved.value : null;
  const load = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const r = await requestJson("/api/writer/pins", {
        signal: controller.signal,
      });
      if (controller.signal.aborted || identity.current !== profile.owner)
        return;
      if (!r.response.ok) throw new Error(r.data.error);
      setSaved({ owner: profile.owner, value: r.data as Pins });
      setSelected("");
      window.dispatchEvent(
        new CustomEvent("syaahi-profile-pins", { detail: profile.slug }),
      );
    } catch (e) {
      if (!controller.signal.aborted && identity.current === profile.owner)
        setError((e as Error).message);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
      }
    }
  }, [profile.owner, profile.slug]);
  useEffect(() => {
    setSaved(null);
    setBusy(false);
    void load();
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [load]);
  async function act(storyId: string, action: PinAction) {
    if (!data || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await requestJson("/api/writer/pins", {
        method: "PATCH",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          action,
          expectedUpdatedAt: data.updatedAt,
        }),
      });
      if (controller.signal.aborted || identity.current !== profile.owner)
        return;
      if (!r.response.ok) throw new Error(r.data.error);
      setSaved({ owner: profile.owner, value: r.data as Pins });
      setSelected("");
      setMessage(
        "Profile pins saved. Only currently published stories appear publicly.",
      );
      window.dispatchEvent(
        new CustomEvent("syaahi-profile-pins", { detail: profile.slug }),
      );
    } catch (e) {
      if (!controller.signal.aborted && identity.current === profile.owner)
        setError((e as Error).message);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  const choices =
    data?.choices.filter((s) => !data.pinned.some((p) => p.id === s.id)) || [];
  return (
    <section
      className="writer-featured-stories"
      id="featured-stories"
      aria-labelledby="featured-heading"
    >
      <div className="writer-featured-heading">
        <div>
          <p className="writer-kicker">YOUR BEST WORK, FIRST</p>
          <h2 id="featured-heading">Featured stories</h2>
        </div>
        <span>{data?.pinned.length || 0}/3 pins</span>
      </div>
      <p>
        Pin up to three approved stories above the rest of your public profile.
        Move them into the order you want readers to see.
      </p>
      {loading && <p role="status">Loading profile pins…</p>}
      {error && (
        <div>
          <p role="alert">{error}</p>
          <button
            className="btn light"
            disabled={busy || loading}
            onClick={() => void load()}
          >
            Reload profile pins
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          {data.pinned.length ? (
            <ol>
              {data.pinned.map((s, i) => (
                <li key={s.id}>
                  <div>
                    <span className="writer-featured-number" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div>
                      {s.published && s.slug ? (
                        <a href={`/guides/${s.slug}`}>{s.title}</a>
                      ) : (
                        <strong>{s.title}</strong>
                      )}
                      {!s.published && (
                        <small>
                          Hidden from your public profile. Unpin to free this
                          slot.
                        </small>
                      )}
                    </div>
                  </div>
                  <div className="writer-featured-controls">
                    <button
                      className="btn light"
                      aria-label={`Move ${s.title} earlier`}
                      disabled={busy || loading || i === 0}
                      onClick={() => void act(s.id, "move_up")}
                    >
                      Earlier
                    </button>
                    <button
                      className="btn light"
                      aria-label={`Move ${s.title} later`}
                      disabled={busy || loading || i === data.pinned.length - 1}
                      onClick={() => void act(s.id, "move_down")}
                    >
                      Later
                    </button>
                    <button
                      className="writer-text-button"
                      aria-label={`Unpin ${s.title}`}
                      disabled={busy || loading}
                      onClick={() => void act(s.id, "unpin")}
                    >
                      Unpin
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="writer-fine-print">
              No pinned stories yet. Your published stories keep their usual
              order.
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selected) void act(selected, "pin");
            }}
          >
            <label>
              Published story to pin
              <select
                value={selected}
                disabled={busy || loading || data.pinned.length >= 3}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Choose a published story</option>
                {choices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn dark"
              disabled={busy || loading || !selected || data.pinned.length >= 3}
            >
              {busy ? "Saving…" : "Pin story"}
            </button>
          </form>
          <small>
            Choose from your latest 50 published stories. You can also pin an
            older article from its author menu.
          </small>
        </>
      )}
    </section>
  );
}
