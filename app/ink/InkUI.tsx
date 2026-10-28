"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  FileSearch,
  FolderOpen,
  PenLine,
  ScanLine,
  ShieldCheck,
  CircleHelp,
  X,
} from "lucide-react";

const links = [
  { href: "/ink", label: "Document check", icon: FileSearch },
  { href: "/ink/reports", label: "My reports", icon: FolderOpen },
  { href: "/ink/sources", label: "Source index", icon: FileSearch },
  { href: "/ink/rewrite", label: "Improve writing", icon: PenLine },
  { href: "/ink/how-it-works", label: "How it works", icon: CircleHelp },
];

export function InkNavigation() {
  const pathname = usePathname();
  return (
    <>
      <aside className="ink-sidebar">
        <Link href="/ink" className="ink-mark">
          <span className="ink-brand-icon">
            <ScanLine size={23} />
          </span>
          <span>
            <b>
              AI Ink<span className="ink-brand-dot">.</span>
            </b>
            <small>BY SYAAHII</small>
          </span>
        </Link>
        <p className="ink-nav-caption">YOUR WRITING SPACE</p>
        <nav aria-label="AI Ink">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (
                  href === "/ink"
                    ? pathname === href || pathname.startsWith("/ink/report/")
                    : pathname.startsWith(href)
                )
                  ? "page"
                  : undefined
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="ink-side-bottom">
          <div className="ink-private-note">
            <ShieldCheck size={20} />
            <div>
              <strong>Private by design</strong>
              <small>Reports belong to you.</small>
            </div>
          </div>
          <Link href="/dashboard" className="ink-workspace-link">
            <ArrowLeft size={16} /> Student workspace
          </Link>
        </div>
      </aside>
      <header className="ink-topbar">
        <span>
          <Link href="/dashboard">Student workspace</Link>{" "}
          <span className="ink-breadcrumb-slash">/</span>{" "}
          <strong>AI Ink</strong>
        </span>
        <span className="ink-top-status">
          <span /> Document studio
        </span>
      </header>
    </>
  );
}

/** Small native intersection observer; no scroll hijacking or animation bundle. */
export function InkMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (
      !root.current ||
      !window.IntersectionObserver ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("ink-in-view");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.06 },
    );
    const observe = () =>
      root.current?.querySelectorAll("[data-ink-reveal]").forEach((el) => {
        if (!observed.has(el)) {
          observed.add(el);
          observer.observe(el);
        }
      });
    observe();
    const changes = new MutationObserver(observe);
    changes.observe(root.current, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      changes.disconnect();
    };
  }, [pathname]);
  return (
    <div ref={root} className="ink-content">
      {children}
    </div>
  );
}

export function InkDialog({
  open,
  onClose,
  title,
  children,
  wide = false,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`ink-dialog${wide ? " ink-dialog--wide" : ""}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ink-dialog-head">
        <h2 id={id}>{title}</h2>
        {dismissible && (
          <button
            type="button"
            className="ink-icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        )}
      </div>
      <div className="ink-dialog-body">{children}</div>
    </dialog>
  );
}

export function InkPaperArt({ scanning = false }: { scanning?: boolean }) {
  return (
    <div
      className={`ink-paper-art${scanning ? " is-scanning" : ""}`}
      aria-hidden="true"
    >
      <div className="ink-art-page ink-art-page-back" />
      <div className="ink-art-page">
        <span className="ink-art-label">RESEARCH PAPER</span>
        <span className="ink-art-title" />
        <span className="ink-art-title short" />
        <div className="ink-art-lines">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={i === 2 || i === 5 ? "marked" : ""} />
          ))}
        </div>
        <span className="ink-art-check">
          <ShieldCheck size={22} />
        </span>
        {scanning && <span className="ink-scan-beam" />}
      </div>
      <span className="ink-art-orbit ink-art-orbit-one" />
      <span className="ink-art-orbit ink-art-orbit-two" />
    </div>
  );
}
