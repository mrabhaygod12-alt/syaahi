import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import type { Metadata } from "next";
import "./globals.css";
import { ToastHost } from "@/components/Toasts";
import CmdK from "@/components/CmdK";
import { SITE, orgSchema, websiteSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  alternates: { canonical: SITE.url },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
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
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Gochi+Hand&family=Indie+Flower&family=Instrument+Sans:wght@400;500;600&family=Kalam:wght@400;700&family=Patrick+Hand&family=Shadows+Into+Light&family=Sora:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
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
        <ToastHost>
          <CmdK />
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </ToastHost>
      </body>
    </html>
  );
}
