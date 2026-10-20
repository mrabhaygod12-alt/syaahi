"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Plus,
  Library,
  Shapes,
  BookOpen,
  ArrowLeft,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import Logo from "@/components/Logo";
import { useAccount } from "@/components/WorkspaceProvider";
import "./studio.css";
export function StudioDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closer = useRef(onClose);
  closer.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      closer.current();
    };
    dialog?.addEventListener("cancel", cancel);
    return () => {
      dialog?.removeEventListener("cancel", cancel);
      dialog?.close();
    };
  }, []);
  return (
    <dialog ref={ref} className="cv-dialog" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <button
          className="cv-icon-button"
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export default function StudioShell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    { user } = useAccount(),
    [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const links = [
    { href: "/presentations", label: "Create", icon: Plus },
    { href: "/presentations/library", label: "Library", icon: Library },
    {
      href: "/presentations/templates",
      label: "Visual directions",
      icon: Shapes,
    },
  ];
  if (/^\/presentations\/(shared|audience)(\/|$)/.test(path))
    return <div className="cv-public">{children}</div>;
  const nav = (
    <nav aria-label="Presentation workspace">
      {links.map(({ href, label, icon: Icon }) => (
        <a
          key={href}
          href={href}
          aria-label={label}
          aria-current={path === href ? "page" : undefined}
        >
          <Icon size={21} />
          <span>{label}</span>
        </a>
      ))}
      <a href="/ai-presentations" aria-label="Studio guide">
        <BookOpen size={21} />
        <span>Guide</span>
      </a>
      <a href="/dashboard" aria-label="Learning dashboard">
        <ArrowLeft size={21} />
        <span>Workspace</span>
      </a>
    </nav>
  );
  return (
    <div className="presentation-workspace cv-shell">
      <aside className="cv-rail">
        <a href="/" aria-label="Syaahi home">
          <Logo size={36} showText={false} />
        </a>
        {nav}
        <span className="cv-avatar" title={user?.name || "Your account"}>
          {user?.name?.slice(0, 1) || "S"}
        </span>
      </aside>
      <div className="cv-shell-main">
        <header className="cv-topbar">
          <button
            className="cv-icon-button cv-mobile-nav"
            aria-label="Open studio navigation"
            onClick={() => setOpen(true)}
          >
            <Menu size={21} />
          </button>
          <a href="/presentations" className="cv-wordmark">
            Syaahi<span> / </span>
            <b>Studio</b>
          </a>
          <span className="cv-mode">
            <ShieldCheck size={14} />
            Source-backed mode
          </span>
          <div className="cv-top-actions">
            <a className="cv-button subtle" href="/presentations/library">
              Your work
            </a>
            <a className="cv-button" href="/presentations/new">
              <Plus size={15} />
              New brief
            </a>
          </div>
        </header>
        {children}
      </div>
      {open && (
        <StudioDialog title="Studio navigation" onClose={() => setOpen(false)}>
          {nav}
        </StudioDialog>
      )}
    </div>
  );
}
