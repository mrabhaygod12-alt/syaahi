"use client";

import { usePathname } from "next/navigation";
import Logo from "./Logo";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/lesson/")) return null;

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
            ["Study Blog", "/blog"],
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
