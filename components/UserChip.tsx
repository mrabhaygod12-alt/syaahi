"use client";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "./WorkspaceProvider";
import { signOut } from "@/lib/auth/session";
import { requestJson } from "@/lib/http-client";
export default function UserChip({ writer = false }: { writer?: boolean }) {
  const { user, loading } = useAccount(),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [writerIdentity, setWriterIdentity] = useState<{
      name: string;
      avatar: string;
    } | null>(null),
    ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    setWriterIdentity(null);
    if (user?.workspace === "writer") {
      requestJson("/api/writer/profile")
        .then(({ response, data }) => {
          if (alive && response.ok) setWriterIdentity(data.profile);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [user?.id, user?.workspace]);
  useEffect(() => {
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);
  const mode = user?.workspace === "writer" ? "writer" : "student",
    displayName =
      mode === "writer" ? writerIdentity?.name || "Writer" : user?.name || "",
    displayAvatar = mode === "writer" ? writerIdentity?.avatar : user?.avatar,
    suffix = writer ? "?workspace=writer" : "?workspace=student";
  if (loading)
    return <span className="account-skeleton" aria-label="Loading account" />;
  if (!user)
    return (
      <div className="guest-account">
        <a className="account-login" href={"/login" + suffix}>
          Log in
        </a>
        <a className="btn dark account-signup" href={"/signup" + suffix}>
          {writer ? "Start writing" : "Start free"}
        </a>
      </div>
    );
  return (
    <div className="experience-user" ref={ref}>
      <button
        className="account-toggle"
        aria-label="Open account menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {displayAvatar ? (
          <img src={displayAvatar} alt="" />
        ) : (
          <span>{displayName.charAt(0)}</span>
        )}
        <b>{displayName.split(" ")[0]}</b>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="experience-user-menu">
          <p>
            <strong>{displayName}</strong>
            <small>
              {mode === "writer" ? "Writer account" : "Student account"}
            </small>
          </p>
          <a href={mode === "writer" ? "/writer/welcome" : "/dashboard"}>
            Your workspace
          </a>
          <a href={mode === "writer" ? "/writer/profile" : "/profile"}>
            Your profile
          </a>
          <a href={mode === "writer" ? "/writer/membership" : "/pricing"}>
            Membership
          </a>
          <a href={mode === "writer" ? "/writer/support" : "/support"}>
            Help & support
          </a>
          <button
            onClick={async () => {
              try {
                await signOut();
                location.assign(writer ? "/writing" : "/");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Sign out failed.");
              }
            }}
          >
            Sign out
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
