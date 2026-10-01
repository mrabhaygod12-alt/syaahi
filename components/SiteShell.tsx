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
          <p>Study notes, PDFs and active recall.</p>
          <p className="small">
            Create notes from course material, review sources and practise
            what you learn.
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
            ["Reviewed guides", "/community"],
            ["Writer Studio", "/write"],
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
            ["Digital delivery", "/delivery"],
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
        <button className="privacy-settings" type="button" onClick={() => window.dispatchEvent(new Event("syaahi:privacy-settings"))}>Privacy preferences</button>
        <span>
          AI helps you study. Verify important facts with original sources.
        </span>
      </div>
    </footer>
  );
}
