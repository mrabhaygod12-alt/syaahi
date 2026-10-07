import { SiteFooter } from "@/components/SiteShell";
import SiteHeader from "@/components/SiteHeader";
import type { Metadata } from "next";
import { Caveat, Instrument_Sans, Kalam, Patrick_Hand } from "next/font/google";
import "./globals.css";
import "./upi-payments.css";
import "./design-refinement.css";
import "./workspace-upgrade.css";
import "./home-positioning.css";
import { SITE, orgSchema, websiteSchema, jsonLd } from "@/lib/seo";
import PrivacyPreferences from "@/components/PrivacyPreferences";
import AuthDialog from "@/components/AuthDialog";
import "./writer-experience.css";
import "@/components/writer/reader.css";
import WorkspaceProvider from "@/components/WorkspaceProvider";
import "./experience-upgrade.css";
import "./product-public.css";
import "katex/dist/katex.min.css";
import GrowthVisit from "@/components/growth/GrowthVisit";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-caveat",
  display: "swap",
  preload: false,
});
const kalam = Kalam({
  subsets: ["latin", "devanagari"],
  weight: ["400", "700"],
  variable: "--font-kalam",
  display: "swap",
  preload: false,
});
const patrickHand = Patrick_Hand({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-patrick-hand",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : {},
  },
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} : ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} : ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
    locale: SITE.locale,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-IN"
      className={`${instrument.variable} ${caveat.variable} ${kalam.variable} ${patrickHand.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(orgSchema()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteSchema()) }}
        />
      </head>
      <body>
        <WorkspaceProvider>
          <SiteHeader />
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
          <PrivacyPreferences />
          <GrowthVisit />
          <AuthDialog />
        </WorkspaceProvider>
      </body>
    </html>
  );
}
