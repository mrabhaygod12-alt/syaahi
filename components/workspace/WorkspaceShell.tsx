"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Logo from "@/components/Logo";
import Loader from "@/components/Loader";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import { useLesson } from "./LessonProvider";
import { ROOMS, lessonTitle, type RoomId } from "./types";
const LessonChat = dynamic(() => import("./LessonChat"), {
  loading: () => <div className="ws-chat-loading">Opening study chat…</div>,
});

function Icon({ id, active }: { id: RoomId; active: boolean }) {
  const c = active ? "#214b40" : "#9a9289";
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: c,
    strokeWidth: 1.8,
  } as const;
  if (id === "learn")
    return (
      <svg {...common}>
        <path d="M4 19a2 2 0 0 1 2-2h12M6 17V5h12v12" />
        <path d="M8 7h8M8 11h5" />
      </svg>
    );
  if (id === "notes")
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  if (id === "quiz")
    return (
      <svg {...common}>
        <rect x="5" y="5" width="14" height="14" rx="3" />
        <path d="M8 12l2.2 2.2L16 9" />
      </svg>
    );
  if (id === "flashcards")
    return (
      <svg {...common}>
        <rect x="4" y="7" width="12" height="12" rx="2" />
        <rect x="8" y="4" width="12" height="12" rx="2" />
      </svg>
    );
  if (id === "podcast")
    return (
      <svg {...common}>
        <path d="M8 12a4 4 0 1 1 8 0" />
        <path d="M12 8v8M8 16h8" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export default function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { job, loading, balance, chatOpen, openChat, closeChat } = useLesson();
  const pathname = usePathname();
  const router = useRouter();

  // Manageable & resizable chat width
  const [chatWidth, setChatWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("syaahi_chat_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 320 && parsed <= 900) setChatWidth(parsed);
      }
    } catch {}
  }, []);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(
        Math.max(320, window.innerWidth - e.clientX),
        Math.min(900, Math.floor(window.innerWidth * 0.88)),
      );
      setChatWidth(newWidth);
    };
    const onMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem("syaahi_chat_width", String(chatWidth));
      } catch {}
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing, chatWidth]);

  const drawerRef = useRef<HTMLDivElement>(null);
  // AI chat lives behind the hamburger — never auto-open, same drawer on every room.
  // Escape closes it like any ChatGPT-style panel.
  useEffect(() => {
    if (!chatOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => drawerRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const controls = Array.from(
          drawerRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),textarea:not([disabled]),input:not([disabled]),a[href],[tabindex="0"]',
          ) || [],
        ).filter((el) => el.getClientRects().length);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === drawerRef.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
      if (e.key === "Escape") closeChat();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [chatOpen, closeChat]);

  const room = (pathname.split("/").pop() || "notes") as RoomId;

  if (loading && !job) {
    return <WorkspaceSkeleton />;
  }
  if (!job) {
    return (
      <div className="ws-loading">
        <p>Unknown lesson.</p>
        <Link href="/dashboard">← Home</Link>
      </div>
    );
  }

  if (job.status === "error" && !job.pages.length) {
    const shortage = job.shortage;
    return (
      <div className="ws-gate">
        <Link href="/dashboard">← Home</Link>
        <div className="card" style={{ marginTop: 16, maxWidth: 520 }}>
          <b style={{ color: shortage ? "#b45309" : "#dc2626" }}>
            {shortage ? "Not enough credits" : "Lesson failed"}
          </b>
          <p className="small" style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
            {job.error}
          </p>
          {shortage && (
            <p>
              Need <b>{Math.max(0, shortage.need - shortage.have)}</b> more
              credits · balance <b>{shortage.have}</b>
            </p>
          )}
          <div
            style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}
          >
            <a className="btn light" href="/pricing">
              Buy a pack
            </a>
            <button
              className="btn light"
              onClick={async () => {
                await fetch(`/api/jobs/${job.id}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "resume" }),
                });
                router.refresh();
                window.location.reload();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (job.status === "working" || job.status === "queued") {
    const planned = job.plannedTotal ?? job.total;
    const ready = job.pages.length;
    return (
      <div className="ws-gate">
        <p className="small">
          <Link href="/dashboard">Home</Link> ›{" "}
          {(job.topics[0] ?? "Lesson").slice(0, 48)}
        </p>
        <Loader
          done={ready}
          total={planned}
          currentTopic={job.topics[ready] ?? null}
        />
        {job.planNote && (
          <div className="ws-plan-note">
            <b>Plan · </b>
            {job.planNote}
          </div>
        )}
        <ol className="ws-live-list">
          {job.topics.map((t, i) => (
            <li
              key={i}
              className={i < ready ? "done" : i === ready ? "now" : ""}
            >
              <span className="ws-live-idx">
                {i < ready ? "✓" : i === ready ? "✦" : "○"}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <p className="small" style={{ textAlign: "center" }}>
          {ready} of {planned} pages generated · auto-refreshes every few
          seconds
        </p>
      </div>
    );
  }

  const title = lessonTitle(job);

  return (
    <div className="ws-app">
      <aside className="ws-rail">
        <Link href="/dashboard" className="ws-brand" title="Syaahi Home">
          <Logo size={34} showText={false} />
        </Link>
        <nav className="ws-nav">
          {ROOMS.map((r) => {
            const active = room === r.id;
            return (
              <Link
                key={r.id}
                href={`/lesson/${job.id}/${r.href}`}
                className={`ws-nav-item ${active ? "active" : ""}`}
              >
                <Icon id={r.id} active={active} />
                <span>{r.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="ws-body">
        <header className="ws-top">
          <nav className="ws-crumb">
            <Link href="/dashboard">Home</Link>
            <span>›</span>
            <span>{title}</span>
          </nav>
          <div className="ws-top-actions">
            <span className="small ws-balance-badge">
              Balance <b>{balance ?? "…"}</b>
            </span>
            <a className="btn dark ws-upgrade" href="/pricing">
              Upgrade
            </a>
            <button
              className={`ws-burger ${chatOpen ? "open" : ""}`}
              onClick={() => (chatOpen ? closeChat() : openChat())}
              aria-label={chatOpen ? "Close AI chat" : "Open AI chat"}
              aria-expanded={chatOpen}
              title="AI chat"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </header>

        <div className="ws-stage">
          <div className="ws-main">
            {job.status === "error" && (
              <div className="inline-error">
                Generation stopped. Your completed sections are available;
                unused credits were returned.{" "}
                <button
                  className="btn light"
                  onClick={async () => {
                    const r = await fetch(`/api/jobs/${job.id}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "resume" }),
                    });
                    if (r.ok) window.location.reload();
                    else {
                      const d = await r.json();
                      alert(d.error || "Could not resume.");
                    }
                  }}
                >
                  Resume missing sections
                </button>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
      {chatOpen && (
        <div className="ws-overlay" onClick={closeChat}>
          <div
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Syaahi study assistant"
            className={`ws-drawer ${isResizing ? "resizing" : ""}`}
            style={{ width: chatWidth, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Draggable manual resize handle on left edge */}
            <div
              className="ws-drawer-resizer"
              onMouseDown={startResizing}
              title="Drag to resize chat panel"
              aria-label="Drag to resize chat panel"
            >
              <div className="resizer-handle-grip" />
            </div>
            <LessonChat
              job={job}
              variant="overlay"
              onClose={closeChat}
              currentWidth={chatWidth}
              onSetWidth={(w) => {
                setChatWidth(w);
                try {
                  localStorage.setItem("syaahi_chat_width", String(w));
                } catch {}
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
