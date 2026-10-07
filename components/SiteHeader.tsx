"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import UserChip from "./UserChip";
import { useAccount } from "./WorkspaceProvider";
import { publishingPath } from "@/lib/workspace-routing";
import "./site-header.css";
export default function SiteHeader() {
  const path = usePathname() || "/",
    { user } = useAccount();
  const [open, setOpen] = useState(false),
    ref = useRef<HTMLElement>(null),
    button = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);
  if (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/lesson/") ||
    path === "/presentations" ||
    path.startsWith("/presentations/") ||
    path === "/write" ||
    path === "/writer" ||
    path.startsWith("/writer/")
  )
    return null;
  const editorial = publishingPath(path) || user?.workspace === "writer";
  const links = editorial
    ? [
        ["Discover", "/community"],
        ["For writers", "/writing"],
        ["Membership", "/writer/membership"],
      ]
    : !user && path === "/"
      ? [
          ["For learners", "/#learn"],
          ["For writers", "/writing"],
          ["Examples", "/examples"],
          ["Plans", "/pricing"],
        ]
      : [
          ["Workspace", "/dashboard"],
          ["Subjects", "/subjects"],
          ["About", "/about"],
          ["Plans", "/pricing"],
        ];
  return (
    <header
      ref={ref}
      className={"experience-header" + (editorial ? " editorial-header" : "")}
    >
      <div className="experience-header-inner">
        <a
          href={editorial ? "/writing" : "/"}
          className="brand"
          aria-label={editorial ? "Syaahi writing home" : "Syaahi home"}
        >
          <Logo size={34} />
          {editorial && <span className="header-edition">Stories</span>}
        </a>
        <nav
          id="site-navigation"
          aria-label="Main navigation"
          className={open ? "experience-nav open" : "experience-nav"}
        >
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="experience-account">
          {!editorial && (
            <a
              className="header-language"
              href={path === "/hi" ? "/" : "/hi"}
              lang={path === "/hi" ? "en" : "hi"}
            >
              {path === "/hi" ? "EN" : "हिंदी"}
            </a>
          )}
          <UserChip writer={editorial} />
          <button
            ref={button}
            className="experience-menu"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="site-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? "×" : "☰"}
          </button>
        </div>
      </div>
    </header>
  );
}
