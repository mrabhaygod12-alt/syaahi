"use client";

import InstallApp from "./InstallApp";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import UserChip from "./UserChip";
import "./site-header.css";

type NavItem = { label: string; detail: string; href: string };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Study",
    items: [
      {
        label: "Study workspace",
        detail: "Create and continue your lessons",
        href: "/dashboard",
      },
      {
        label: "Subjects",
        detail: "Start with a familiar topic",
        href: "/subjects",
      },
      {
        label: "Library",
        detail: "Return to saved material",
        href: "/library",
      },
      {
        label: "Examples",
        detail: "Preview the note format",
        href: "/examples",
      },
      {
        label: "Course packs",
        detail: "University study-outline starters",
        href: "/course-packs",
      },
    ],
  },
  {
    label: "Practice",
    items: [
      {
        label: "Mock interviews",
        detail: "Role-based answer practice",
        href: "/interview",
      },
      {
        label: "How Syaahi works",
        detail: "See each study step",
        href: "/how-it-works",
      },
      {
        label: "Documentation",
        detail: "Guides for study tools",
        href: "/docs",
      },
    ],
  },
  {
    label: "Community",
    items: [
      {
        label: "Study guides",
        detail: "Browse reviewed public guides",
        href: "/community",
      },
      {
        label: "Writer Studio",
        detail: "Draft a guide privately",
        href: "/write",
      },
      {
        label: "Study blog",
        detail: "Read practical study ideas",
        href: "/blog",
      },
      {
        label: "Campus pilots",
        detail: "Apply as a campus ambassador",
        href: "/campus",
      },
      {
        label: "For institutions",
        detail: "Discuss a student pilot",
        href: "/enterprise",
      },
    ],
  },
];

const directLinks = [
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
];

export default function SiteHeader() {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setReady(true);
    setMobileOpen(false);
    setOpenGroup(null);
  }, [path]);

  useEffect(() => {
    const closeIfOutside = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (
          window.matchMedia("(max-width: 1080px)").matches &&
          navigationRef.current?.contains(document.activeElement)
        )
          menuButton.current?.focus();
        setOpenGroup(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (path?.startsWith("/lesson/")) return null;
  const isCurrent = (href: string) =>
    path === href || (href !== "/" && Boolean(path?.startsWith(`${href}/`)));

  return (
    <header ref={headerRef} className="top site-header">
      <div className="wrap header-row">
        <a className="brand" href="/" aria-label="Syaahi home">
          <Logo />
        </a>
        <nav
          ref={navigationRef}
          id="site-navigation"
          className={mobileOpen ? "site-nav open" : "site-nav"}
          aria-label="Main navigation"
        >
          {groups.map((group) => {
            const active = group.items.some((item) => isCurrent(item.href));
            const isOpen = openGroup === group.label;
            return (
              <div
                className={active ? "nav-menu is-active" : "nav-menu"}
                key={group.label}
              >
                <button
                  className="nav-trigger"
                  type="button"
                  disabled={!ready}
                  aria-controls={`nav-${group.label.toLowerCase()}`}
                  aria-expanded={isOpen}
                  onClick={() => setOpenGroup(isOpen ? null : group.label)}
                >
                  {group.label} <span aria-hidden="true">⌄</span>
                </button>
                <div
                  className={isOpen ? "nav-popover is-open" : "nav-popover"}
                  hidden={!isOpen}
                  style={!isOpen ? { display: "none" } : undefined}
                  id={`nav-${group.label.toLowerCase()}`}
                >
                  {group.items.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      aria-current={isCurrent(item.href) ? "page" : undefined}
                      onClick={() => {
                        setMobileOpen(false);
                        setOpenGroup(null);
                      }}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
          {directLinks.map((link) => (
            <a
              className="nav-direct-link"
              key={link.href}
              href={link.href}
              aria-current={isCurrent(link.href) ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="header-account">
          <InstallApp />
          <UserChip />
          <button
            ref={menuButton}
            className="mobile-menu"
            type="button"
            disabled={!ready}
            aria-expanded={mobileOpen}
            aria-controls="site-navigation"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            onClick={() => {
              setMobileOpen((value) => !value);
              setOpenGroup(null);
            }}
          >
            <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
