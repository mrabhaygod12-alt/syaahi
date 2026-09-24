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
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
];
export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
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
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Logo size={38} />
          <p>Make room for understanding.</p>
          <p className="small">
            Your material, thoughtfully organised into notes and active
            practice.
          </p>
        </div>
        {[
          [
            "Explore",
            ["Workspace", "/dashboard"],
            ["Subjects", "/subjects"],
            ["Library", "/library"],
            ["Interview practice", "/interview"],
          ],
          [
            "Resources",
            ["About the creator", "/about"],
            ["How it works", "/how-it-works"],
            ["Documentation", "/docs"],
            ["Support", "/support"],
            ["Pricing", "/pricing"],
          ],
          [
            "Trust",
            ["Privacy", "/privacy"],
            ["Terms", "/terms"],
            ["Refunds", "/refunds"],
            ["Cookies", "/cookies"],
            ["Acceptable use", "/acceptable-use"],
            ["Disclaimer", "/disclaimer"],
          ],
        ].map(([title, ...items]) => (
          <div key={title as string}>
            <h3>{title as string}</h3>
            {(items as string[][]).map(([label, url]) => (
              <a key={url} href={url}>
                {label}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="wrap footer-bottom">
        <span>© {new Date().getFullYear()} Syaahi</span>
        <span>
          AI helps you study. Verify important facts with original sources.
        </span>
      </div>
    </footer>
  );
}
