"use client";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Home,
  Layers3,
  Palette,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight,
  BookOpen,
  LifeBuoy,
  Search,
} from "lucide-react";
import { useAccount } from "@/components/WorkspaceProvider";
import "./presentation-studio.css";
import "./workspace.css";
export default function PresentationWorkspace({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname(),
    { user } = useAccount(),
    [open, setOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null),
    menu = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    menu.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const nodes = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ) || [],
      );
    nodes()[0]?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab") {
        const list = nodes(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const resize = () => {
      if (window.innerWidth > 800) setOpen(false);
    };
    window.addEventListener("keydown", keys);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("keydown", keys);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  if (/^\/presentations\/(shared|audience)(\/|$)/.test(path))
    return <>{children}</>;
  const links = [
    { href: "/presentations", label: "Create", icon: Plus },
    {
      href: "/presentations/library",
      label: "My presentations",
      icon: Layers3,
    },
    { href: "/presentations/templates", label: "Templates", icon: Palette },
  ];
  const editor = /^\/presentations\/(?!new$|library$|templates$)[^/]+$/.test(
    path,
  );
  return (
    <div
      className={
        "presentation-workspace" + (editor ? " pw-editor-workspace" : "")
      }
    >
      <aside
        ref={sidebar}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Studio navigation"
        className={"pw-sidebar" + (open ? " is-open" : "")}
      >
        <a className="pw-brand" href="/presentations">
          <span>S.</span>{" "}
          <b>
            Syaahi <small>Presentation studio</small>
          </b>
        </a>
        <div className="pw-identity">
          <i>{(user?.name || "Your").slice(0, 1)}</i>
          <div>
            <strong>{user?.name || "Your workspace"}</strong>
            <small>
              {user ? "Private learning workspace" : "Create with clarity"}
            </small>
          </div>
        </div>
        <nav aria-label="Presentation workspace">
          {links.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              title={label}
              aria-label={label}
              aria-current={path === href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="pw-sidebar-note">
          <BookOpen size={20} />
          <strong>A story before a slide</strong>
          <p>
            Bring a brief or your sources. Review the narrative, then build your
            presentation.
          </p>
        </div>
        <nav className="pw-bottom" aria-label="Workspace links">
          <a
            href="/dashboard"
            title="Learning dashboard"
            aria-label="Learning dashboard"
          >
            <Home size={18} />
            <span>Learning dashboard</span>
          </a>
          <a href="/support" title="Help & support" aria-label="Help & support">
            <LifeBuoy size={18} />
            <span>Help & support</span>
          </a>
          <a href="/pricing" title="Membership" aria-label="Membership">
            <ArrowUpRight size={18} />
            <span>Membership</span>
          </a>
        </nav>
      </aside>
      <div className="pw-main">
        <header className="pw-topbar">
          <button
            ref={menu}
            className="pw-mobile-menu"
            aria-label={
              open ? "Close studio navigation" : "Open studio navigation"
            }
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <PanelLeftClose size={21} /> : <PanelLeftOpen size={21} />}
          </button>
          <span>
            <span className="pw-status-dot" />
            Your ideas, clearly presented
          </span>
          <div>
            <a
              href="/presentations/library"
              aria-label="Search your presentations"
            >
              <Search size={18} />
            </a>
            <a href="/presentations/new" className="pw-small-button">
              <Plus size={16} />
              New presentation
            </a>
          </div>
        </header>
        {children}
      </div>
      {open && (
        <button
          className="pw-scrim"
          aria-label="Close navigation"
          onClick={close}
        />
      )}
    </div>
  );
}
