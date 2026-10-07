"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { requestJson } from "@/lib/http-client";
import { signOut } from "@/lib/auth/session";
import type { WriterProfile } from "@/lib/writing/profile";
import Logo from "../Logo";
import { useAccount } from "../WorkspaceProvider";
const ProfileContext = createContext<{
  profile: WriterProfile;
  update: (p: WriterProfile) => void;
} | null>(null);
export const useWriter = () => useContext(ProfileContext)!;
const links = [
  ["Your space", "/writer/welcome", "write"],
  ["Home", "/writer", "home"],
  ["Library", "/writer/library", "bookmark"],
  ["Profile", "/writer/profile", "user"],
  ["Stories", "/writer/stories", "story"],
  ["Stats", "/writer/stats", "stats"],
];
export function WriterIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
    bookmark: "M6 3h12v18l-6-4-6 4Z",
    user: "M20 21v-3a8 8 0 0 0-16 0v3M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    story: "M5 3h14v18H5ZM8 7h8M8 11h8M8 15h5",
    stats: "M4 21v-8h4v8Zm6 0V8h4v13Zm6 0V3h4v18Z",
    write: "m15 4 5 5M4 20l5-1L21 7l-5-5L4 14ZM11 4H3v17h17v-8",
    search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6",
    menu: "M3 6h18M3 12h18M3 18h18",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.story} />
    </svg>
  );
}
export function WriterAvatar({
  profile,
  size = 36,
}: {
  profile: Pick<WriterProfile, "avatar" | "name">;
  size?: number;
}) {
  return (
    <span className="writer-avatar" style={{ width: size, height: size }}>
      {profile.avatar ? (
        <img src={profile.avatar} alt="" />
      ) : (
        profile.name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
export default function WriterShell({
  children,
  editor = false,
}: {
  children: ReactNode;
  editor?: boolean;
}) {
  const [profile, setProfile] = useState<WriterProfile | null>(null),
    [status, setStatus] = useState("loading"),
    [error, setError] = useState(""),
    [menu, setMenu] = useState(false),
    [nav, setNav] = useState(false);
  const path = usePathname();
  const account = useAccount();
  const profileRequest = useRef<AbortController | null>(null);
  const load = () => {
    profileRequest.current?.abort();
    const controller = new AbortController();
    profileRequest.current = controller;
    setStatus("loading");
    setError("");
    requestJson("/api/writer/profile", { signal: controller.signal })
      .then(({ response, data }) => {
        if (controller.signal.aborted || profileRequest.current !== controller)
          return;
        if (response.status === 401) return setStatus("guest");
        if (data.code === "WRITER_ENROLLMENT_REQUIRED")
          return setStatus("enroll");
        if (!response.ok)
          throw new Error(data.error || "Could not open your writer profile.");
        setProfile(data.profile);
        setStatus("ready");
      })
      .catch((e) => {
        if (controller.signal.aborted || profileRequest.current !== controller)
          return;
        setError(e.message);
        setStatus("error");
      });
  };
  useEffect(() => {
    profileRequest.current?.abort();
    setProfile(null);
    if (account.loading) return;
    if (account.error) {
      setError(account.error);
      setStatus("error");
      return;
    }
    if (account.user && account.user.workspace !== "writer") {
      setStatus("student");
      return;
    }
    load();
    return () => profileRequest.current?.abort();
  }, [
    account.loading,
    account.user?.id,
    account.user?.workspace,
    account.error,
  ]);
  const ready =
    status === "ready" &&
    !account.loading &&
    !account.error &&
    account.user?.workspace === "writer";
  useEffect(() => {
    if (!profile) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.writerTheme =
        profile.appearance === "system"
          ? query.matches
            ? "dark"
            : "light"
          : profile.appearance);
    apply();
    query.addEventListener("change", apply);
    return () => {
      delete document.documentElement.dataset.writerTheme;
      query.removeEventListener("change", apply);
    };
  }, [profile?.appearance]);
  useEffect(() => {
    const close = (e: Event) => {
      if (!(e.target as HTMLElement).closest?.(".writer-account"))
        setMenu(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setNav(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <div className={`writer-app${editor ? " is-editor" : ""}`}>
      <header className="writer-header">
        {!editor && (
          <button
            className="writer-icon-button"
            aria-label="Toggle writer navigation"
            aria-expanded={nav}
            onClick={() => setNav(!nav)}
          >
            <WriterIcon name="menu" />
          </button>
        )}
        <a
          href="/writer/welcome"
          className="writer-brand"
          aria-label="Syaahi writer home"
        >
          <Logo size={32} />
        </a>
        {editor ? (
          <span className="writer-header-label">
            Draft <span>in Syaahi</span>
          </span>
        ) : (
          <form className="writer-search" action="/writer">
            <WriterIcon name="search" />
            <input
              type="search"
              name="q"
              aria-label="Search stories"
              placeholder="Search stories and topics"
            />
          </form>
        )}
        <div className="writer-header-right">
          {!editor && (
            <a className="writer-write-link" href="/write">
              <WriterIcon name="write" />
              <span>Write</span>
            </a>
          )}
          {profile && ready ? (
            <div className="writer-account">
              <button
                className="writer-icon-button"
                aria-label="Open writer account menu"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                <WriterAvatar profile={profile} />
              </button>
              {menu && (
                <div className="writer-account-menu">
                  <a href="/writer/profile" className="writer-menu-identity">
                    <WriterAvatar profile={profile} size={42} />
                    <span>
                      <strong>{profile.name}</strong>
                      <small>View writer profile</small>
                    </span>
                  </a>
                  <a href="/write">Write a story</a>
                  <a href="/writer/stories">Your stories</a>
                  <a href="/writer/stats">Stats</a>
                  <hr />
                  <a href="/writer/settings">Settings & appearance</a>
                  <a href="/writer/billing">Membership & billing</a>
                  <a href="/writer/membership">Upgrade your plan ↗</a>
                  <a href="/writer/support">Help</a>
                  <hr />
                  <button
                    onClick={async () => {
                      try {
                        await signOut();
                        location.assign("/writing");
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : "Sign out failed.",
                        );
                      }
                    }}
                  >
                    Sign out
                  </button>
                  {error && <p role="alert">{error}</p>}
                </div>
              )}
            </div>
          ) : (
            <a
              className="btn light"
              href="/login?workspace=writer&next=/writer"
            >
              Log in
            </a>
          )}
        </div>
      </header>
      {!ready ? (
        <section className="writer-gate">
          <p className="writer-kicker">SYAAHI WRITERS</p>
          <h1>
            {status === "loading"
              ? "Opening your writing space…"
              : status === "error"
                ? "Your workspace could not open."
                : "A home for your ideas."}
          </h1>
          {status === "loading" ? (
            <p role="status">Connecting to your account.</p>
          ) : status === "error" ? (
            <>
              <p role="alert">{error}</p>
              <button
                className="btn dark"
                onClick={account.error ? account.refresh : load}
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <p>
                {status === "student"
                  ? "Sign in as a writer to open your writing space. Your student workspace stays separate."
                  : status === "enroll"
                    ? "Create a writer profile with your existing email and password. Your student profile stays separate, and your membership covers both workspaces."
                    : "Sign in to write, save drafts and share what you know."}
              </p>
              <a
                className="btn dark"
                href={`/signup?workspace=writer&next=${encodeURIComponent(path || "/writer")}`}
              >
                Create writer profile
              </a>{" "}
              <a
                className="btn light"
                href={`/login?workspace=writer&next=${encodeURIComponent(path || "/writer")}`}
              >
                Log in
              </a>
            </>
          )}
        </section>
      ) : (
        <ProfileContext.Provider
          value={{ profile: profile!, update: setProfile }}
        >
          {editor ? (
            children
          ) : (
            <div className="writer-layout">
              <aside
                className={`writer-sidebar${nav ? " expanded" : ""}`}
                aria-label="Writer navigation"
              >
                <nav>
                  {links.map(([label, href, icon]) => (
                    <a
                      key={href}
                      href={href}
                      aria-current={path === href ? "page" : undefined}
                    >
                      <WriterIcon name={icon} />
                      {label}
                    </a>
                  ))}
                </nav>
                <div className="writer-sidebar-bottom">
                  <a href="/writer/settings">Settings</a>
                  <a href="/writer/membership">Membership ↗</a>
                  <a href="/writer/support">Help & support</a>
                  <small>
                    © Syaahi · <a href="/privacy">Privacy</a> ·{" "}
                    <a href="/terms">Terms</a>
                  </small>
                </div>
              </aside>
              <div className="writer-workspace">{children}</div>
            </div>
          )}
        </ProfileContext.Provider>
      )}
    </div>
  );
}
