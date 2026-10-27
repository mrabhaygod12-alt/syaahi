import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./ink.css";
import InkAccess from "./InkAccess";
import CompanyCopyright from "@/components/CompanyCopyright";
import { InkMotion, InkNavigation } from "./InkUI";

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

export default function InkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`ink-shell ${newsreader.variable} ${plexSans.variable}`}>
      <InkNavigation />
      <InkMotion>
        <InkAccess>{children}</InkAccess>
        <footer className="ink-footer">
          <CompanyCopyright />
          <span>Private documents. Clearer writing.</span>
        </footer>
      </InkMotion>
    </div>
  );
}
