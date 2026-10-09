"use client";
import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "@/components/WorkspaceProvider";
export default function FollowWriter({
  slug,
  onChange,
}: {
  slug: string;
  onChange?: () => void;
}) {
  const { user, loading } = useAccount(),
    [state, setState] = useState<{
      followers: number;
      followingCount: number;
      following: boolean;
      isOwn: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const path = `/api/creators/${encodeURIComponent(slug)}/follow`;
  const key = `${path}:${loading ? "loading" : user?.id || "guest"}`;
  const identity = useRef(key);
  identity.current = key;
  const request = useRef<AbortController | null>(null),
    pending = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    setState(null);
    setError("");
    setBusy(false);
    pending.current = null;
    if (loading) return () => controller.abort();
    void requestJson(path, { signal: controller.signal })
      .then(({ response, data }) => {
        if (controller.signal.aborted || identity.current !== key) return;
        if (!response.ok) throw new Error(data.error);
        setState(data as any);
      })
      .catch((e) => {
        if (!controller.signal.aborted && identity.current === key)
          setError(e.message);
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [key]);
  async function change() {
    if (!state || pending.current) return;
    pending.current = key;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const { response, data } = await requestJson(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !state?.following }),
        signal: controller.signal,
      });
      if (controller.signal.aborted || identity.current !== key) return;
      if (!response.ok) throw new Error(data.error);
      setState(data as any);
      onChange?.();
    } catch (e) {
      if (!controller.signal.aborted && identity.current === key)
        setError((e as Error).message);
    } finally {
      if (identity.current === key) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div className="writer-follow">
      <span>
        {state
          ? `${state.followers} followers · ${state.followingCount} following`
          : error
            ? "Connections unavailable"
            : "Loading followers…"}
      </span>
      {!state?.isOwn &&
        (user ? (
          <button
            className="btn light"
            disabled={busy || !state || loading}
            aria-pressed={!!state?.following}
            onClick={() => void change()}
          >
            {state?.following ? "Following" : "Follow writer"}
          </button>
        ) : (
          <a
            href={`/login?next=${encodeURIComponent(`/creators/${slug}`)}`}
            className="btn light"
          >
            Sign in to follow
          </a>
        ))}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
