"use client";

import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { useAccount } from "./WorkspaceProvider";
import { publishingPath } from "@/lib/workspace-routing";

export function SiteFooter() {
  const pathname = usePathname();
  const { user } = useAccount();
  if (
    pathname?.startsWith("/lesson/") ||
    pathname === "/write" ||
    pathname === "/writer" ||
    pathname?.startsWith("/writer/")
  )
    return null;
  if (user?.workspace === "writer" || publishingPath(pathname || ""))
    return (
      <footer className="publication-footer">
        <Logo size={30} />
        <p>A home for thoughtful stories.</p>
        <nav aria-label="Publication footer">
          <a href="/community">Discover stories</a>
          <a href="/writing">For writers</a>
          <a href="/writer/support">Help</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
        <small>© {new Date().getFullYear()} Syaahi</small>
        <button
          className="privacy-settings"
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event("syaahi:privacy-settings"))
          }
        >
          Privacy preferences
        </button>
      </footer>
    );

  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Logo size={38} />
          <p>Learn, create and remember.</p>
          <p className="small">
            Notes, presentations and recall practice for curious learners.
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
