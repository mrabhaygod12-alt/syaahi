"use client";

import InstallApp from "./InstallApp";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import UserChip from "./UserChip";

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
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
  }, [path]);

  useEffect(() => {
    const closeIfOutside = (event: MouseEvent) => {
      if (!navigationRef.current?.contains(event.target as Node))
        setOpenGroup(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (path?.startsWith("/lesson/")) return null;
  const isCurrent = (href: string) =>
    path === href || (href !== "/" && Boolean(path?.startsWith(`${href}/`)));

  return (
    <header className="top site-header">
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
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  onClick={() => setOpenGroup(isOpen ? null : group.label)}
                >
                  {group.label} <span aria-hidden="true">⌄</span>
                </button>
                <div
                  className={isOpen ? "nav-popover is-open" : "nav-popover"}
                  role="menu"
                >
                  {group.items.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      role="menuitem"
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
            className="mobile-menu"
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="site-navigation"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileOpen((value) => !value)}
          >
            <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
