"use client";

import InstallApp from "./InstallApp";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";
import UserChip from "./UserChip";

const links = [
  ["Workspace", "/dashboard"],
  ["Subjects", "/subjects"],
  ["Interview", "/interview"],
  ["Blog", "/blog"],
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
];

export default function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path?.startsWith("/lesson/")) return null;
  return (
    <header className="top site-header">
      <div className="wrap header-row">
        <a className="brand" href="/" aria-label="Syaahi home">
          <Logo />
        </a>
        <nav
          className={open ? "site-nav open" : "site-nav"}
          aria-label="Main navigation"
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
        <div className="header-account">
          <InstallApp />
          <UserChip />
          <button
            className="mobile-menu"
            aria-expanded={open}
            aria-label="Toggle navigation"
            onClick={() => setOpen(!open)}
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}
