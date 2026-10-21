import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import Link from "next/link";
import "./ink.css";
import InkAccess from "./InkAccess";
import CompanyCopyright from "@/components/CompanyCopyright";

/**
 * AI Ink lives under its own type identity — a proofing desk, not another SaaS
 * console — because it is a different kind of tool from note generation: the
 * output is a judgement about a document, and it should feel like one.
 */

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-sans",
});

export const metadata: Metadata = {
  title: "AI Ink — integrity check",
  description:
    "Compare a draft against live sources, find uncited claims, and strengthen your own writing before you submit.",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/ink", label: "New check" },
  { href: "/ink/reports", label: "Reports" },
  { href: "/ink/rewrite", label: "Rewrite desk" },
  { href: "/ink/how-it-works", label: "How it works" },
];

export default function InkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`ink-shell ${newsreader.variable} ${plexSans.variable}`}>
      <header className="ink-bar">
        <Link href="/ink" className="ink-mark">
          <b>AI Ink</b>
          <span>by Syaahii</span>
        </Link>
        <nav aria-label="AI Ink">
          <Link href="/dashboard">Workspace</Link>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <InkAccess>{children}</InkAccess>
      <footer className="ink-footer"><CompanyCopyright /><span>Private reports. Clear evidence. Your final judgement.</span></footer>
    </div>
  );
}
