"use client";

import InstallApp from "./InstallApp";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import UserChip from "./UserChip";
import "./site-header.css";

type NavItem = { label: string; detail: string; href: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    id: "learn",
    label: "Learn & create",
    items: [
      {
        label: "Learning workspace",
        detail: "Notes, sources and recall practice",
        href: "/dashboard?view=student",
      },
      {
        label: "AI presentations",
        detail: "Build and edit a PowerPoint deck",
        href: "/presentations",
      },
      {
        label: "Subjects",
        detail: "Start with a familiar topic",
        href: "/subjects",
      },
      {
        label: "Public library",
        detail: "Browse sample learning material",
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
    id: "write",
    label: "Write & publish",
    items: [
      {
        label: "Writing on Syaahi",
        detail: "A workspace for teachers and writers",
        href: "/writing",
      },
      {
        label: "Community articles",
        detail: "Read reviewed articles and guides",
        href: "/community",
      },
      {
        label: "Writer dashboard",
        detail: "Stories, drafts and editorial feedback",
        href: "/writer",
      },
      {
        label: "Writer Studio",
        detail: "Headings, images and private drafts",
        href: "/write",
      },
      {
        label: "Creator profile",
        detail: "Edit your biography and social links",
        href: "/writer/profile",
      },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    items: [
      {
        label: "All features",
        detail: "Learning, writing and presentations",
        href: "/features",
      },
      {
        label: "How it works",
        detail: "Follow both workspace workflows",
        href: "/how-it-works",
      },
      {
        label: "Mock interviews",
        detail: "Practise for a professional role",
        href: "/interview",
      },
      {
        label: "Documentation",
        detail: "Setup, tools and billing help",
        href: "/docs",
      },
      {
        label: "Study blog",
        detail: "Practical learning articles",
        href: "/blog",
      },
      { label: "About", detail: "Meet Chandan and Manish", href: "/about" },
      {
        label: "Support",
        detail: "Get help with your account or work",
        href: "/support",
      },
    ],
  },
];

const directLinks = [{ label: "Pricing", href: "/pricing" }];

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
        if (navigationRef.current?.contains(document.activeElement)) {
          if (window.matchMedia("(max-width: 1080px)").matches)
            menuButton.current?.focus();
          else
            navigationRef.current
              .querySelector<HTMLButtonElement>(
                ".nav-trigger[aria-expanded='true']",
              )
              ?.focus();
        }
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

  if (
    path?.startsWith("/lesson/") ||
    path === "/write" ||
    path === "/writer" ||
    path?.startsWith("/writer/")
  )
    return null;
  const isCurrent = (href: string) =>
    path === href.split("?")[0] ||
    (href !== "/" && Boolean(path?.startsWith(`${href.split("?")[0]}/`)));

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
                  aria-controls={`nav-${group.id}`}
                  aria-expanded={isOpen}
                  onClick={() => setOpenGroup(isOpen ? null : group.label)}
                >
                  {group.label} <span aria-hidden="true">⌄</span>
                </button>
                <div
                  className={isOpen ? "nav-popover is-open" : "nav-popover"}
                  hidden={!isOpen}
                  style={!isOpen ? { display: "none" } : undefined}
                  id={`nav-${group.id}`}
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
