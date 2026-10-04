import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // This route checks publication or ownership on every request; draft
    // images still return 404. Other API endpoints remain outside crawling.
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/writing/images/"],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
