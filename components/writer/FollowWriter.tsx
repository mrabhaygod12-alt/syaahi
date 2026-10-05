"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "@/components/WorkspaceProvider";
export default function FollowWriter({ slug }: { slug: string }) {
  const { user } = useAccount(),
    [state, setState] = useState<{
      followers: number;
      following: boolean;
      isOwn: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const path = `/api/creators/${encodeURIComponent(slug)}/follow`;
  useEffect(() => {
    let cancelled = false;
    setState(null);
    setError("");
    void requestJson(path)
      .then(({ response, data }) => {
        if (response.ok && !cancelled) setState(data as any);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path, user?.id]);
  async function change() {
    setBusy(true);
    setError("");
    try {
      const { response, data } = await requestJson(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !state?.following }),
      });
      if (!response.ok) throw new Error(data.error);
      setState(data as any);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="writer-follow">
      <span>
        {state ? `${state.followers} followers` : "Loading followers…"}
      </span>
      {!state?.isOwn &&
        (user ? (
          <button
            className="btn light"
            disabled={busy || !state}
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
