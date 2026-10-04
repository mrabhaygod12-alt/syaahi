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
          <p>Learn, create and publish.</p>
          <p className="small">
            Notes, presentations and reviewed articles for students, teachers,
            professionals and writers.
          </p>
        </div>
        {[
          [
            "Explore",
            ["Learning workspace", "/dashboard?view=student"],
            ["AI presentations", "/presentations"],
            ["Subjects", "/subjects"],
            ["Library", "/library"],
            ["Interview practice", "/interview"],
          ],
          [
            "Resources",
            ["Writing and publishing", "/writing"],
            ["Community articles", "/community"],
            ["Writer Studio", "/write"],
            ["Writer dashboard", "/writer"],
            ["About the creators", "/about"],
            ["Study blog", "/blog"],
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
        <button
          className="privacy-settings"
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event("syaahi:privacy-settings"))
          }
        >
          Privacy preferences
        </button>
        <span>
          Check AI output and published claims against original sources.
        </span>
      </div>
    </footer>
  );
}
