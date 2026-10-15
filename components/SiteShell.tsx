"use client";

import { usePathname } from "next/navigation";
import CompanyCopyright from "./CompanyCopyright";
import Logo from "./Logo";
import { useAccount } from "./WorkspaceProvider";
import { publishingPath } from "@/lib/workspace-routing";

export function SiteFooter() {
  const pathname = usePathname();
  const { user } = useAccount();
  if (
    pathname === "/admin" ||
    pathname?.startsWith("/admin/") ||
    pathname?.startsWith("/lesson/") ||
    pathname === "/presentations" ||
    pathname?.startsWith("/presentations/") ||
    pathname === "/write" ||
    pathname === "/writer" ||
    pathname?.startsWith("/writer/")
  )
    return (
      <footer className="app-copyright">
        <CompanyCopyright />
        <a href="/feedback">Share feedback</a>
      </footer>
    );
  if (user?.workspace === "writer" || publishingPath(pathname || ""))
    return (
      <footer className="publication-footer">
        <Logo size={30} />
        <p>A home for thoughtful stories.</p>
        <nav aria-label="Publication footer">
          <a href="/community">Discover stories</a>
          <a href="/writing">For writers</a>
          <a href="/writing/features">Writer features</a>
          <a href="/writing/pricing">Writer pricing</a>
          <a href="/feed.xml">Story feed</a>
          <a href="/writer/support">Help</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
        <CompanyCopyright />
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
            ["YouTube video to notes", "/youtube-video-to-notes"],
            ["AI-generated notes", "/ai-generated-notes"],
            ["Subjects", "/subjects"],
            ["Library", "/library"],
            ["Interview practice", "/interview"],
          ],
          [
            "Resources",
            ["What is Syaahi?", "/syaahi"],
            ["Presentation guide", "/ai-presentations"],
            ["About the creators", "/about"],
            ["Study blog", "/blog"],
            ["How it works", "/how-it-works"],
            ["Documentation", "/docs"],
            ["Support", "/support"],
            ["Share feedback", "/feedback"],
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
        <CompanyCopyright />
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
