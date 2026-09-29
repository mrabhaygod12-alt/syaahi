"use client";

import { useEffect } from "react";

export default function PublicationEngagement({ slug }: { slug: string }) {
  useEffect(() => {
    const viewed = `syaahi-guide-viewed:${slug}`;
    if (sessionStorage.getItem(viewed)) return;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(viewed, "1");
      void fetch(`/api/publications/${encodeURIComponent(slug)}/view`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [slug]);
  return null;
}
