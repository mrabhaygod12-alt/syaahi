"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { requestJson, ServiceRequestError } from "@/lib/http-client";
import { useAccount } from "@/components/WorkspaceProvider";
export default function FollowWriter({
  slug,
  onChange,
}: {
  slug: string;
  onChange?: () => void;
}) {
  const { user, loading } = useAccount(),
    [saved, setSaved] = useState<{
      key: string;
      value: {
        followers: number;
        followingCount: number;
        following: boolean;
        isOwn: boolean;
      };
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const path = `/api/creators/${encodeURIComponent(slug)}/follow`;
  const key = `${path}:${loading ? "loading" : user?.id || "guest"}`;
  const state = !loading && saved?.key === key ? saved.value : null;
  const identity = useRef(key);
  identity.current = key;
  const request = useRef<AbortController | null>(null),
    pending = useRef<string | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError("");
    try {
      const { response, data } = await requestJson(path, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || identity.current !== key) return;
      if (!response.ok)
        throw new ServiceRequestError(
          data.error || "Could not load followers.",
          response.status,
          data.requestId,
        );
      if (
        typeof data.followers !== "number" ||
        typeof data.followingCount !== "number" ||
        typeof data.following !== "boolean" ||
        typeof data.isOwn !== "boolean"
      )
        throw new Error(
          "Follower information could not be read. Please retry.",
        );
      setSaved({ key, value: data as NonNullable<typeof saved>["value"] });
    } catch (e) {
      if (!controller.signal.aborted && identity.current === key)
        setError((e as Error).message);
    }
  }, [key, path]);
  useEffect(() => {
    setSaved(null);
    setError("");
    setBusy(false);
    pending.current = null;
    if (!loading) void load();
    return () => {
      request.current?.abort();
    };
  }, [key, loading, load]);
  async function change() {
    if (!state || pending.current) return;
    pending.current = key;
    request.current?.abort();
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
      if (response.status === 401) {
        location.assign(
          `/login?workspace=${user?.workspace || "student"}&next=${encodeURIComponent(location.pathname)}`,
        );
        return;
      }
      if (!response.ok)
        throw new ServiceRequestError(
          data.error || "Could not update this follow.",
          response.status,
          data.requestId,
        );
      setSaved({ key, value: data as NonNullable<typeof saved>["value"] });
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
    <div className="writer-follow" aria-busy={busy}>
      <span aria-live="polite">
        {state
          ? `${state.followers} followers · ${state.followingCount} following`
          : error
            ? "Follower information unavailable"
            : "Loading followers…"}
      </span>
      {!loading &&
        !state?.isOwn &&
        (user ? (
          <button
            className="btn light"
            disabled={busy || !state || loading}
            aria-pressed={!!state?.following}
            onClick={() => void change()}
          >
            {busy
              ? "Updating…"
              : state?.following
                ? "Following"
                : "Follow writer"}
          </button>
        ) : (
          <a
            href={`/login?next=${encodeURIComponent(`/creators/${slug}`)}`}
            className="btn light"
          >
            Sign in to follow
          </a>
        ))}
      {error && (
        <>
          <small role="alert">{error}</small>
          <button
            className="btn light"
            disabled={busy || loading}
            onClick={() => void load()}
          >
            Retry followers
          </button>
        </>
      )}
    </div>
  );
}
