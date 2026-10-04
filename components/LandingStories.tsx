"use client";
import { useEffect, useState } from "react";
import LandingReadingCards from "./LandingReadingCards";
import { requestJson } from "@/lib/http-client";
import type { PublicGuide } from "@/lib/writing/public";

export default function LandingStories() {
  const [stories, setStories] = useState<PublicGuide[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    requestJson("/api/publications", { signal: controller.signal }, 12000)
      .then(({ response, data }) => {
        if (response.ok && Array.isArray(data.stories))
          setStories(data.stories.slice(0, 3));
      })
      .catch(() => {
        /* Generic discovery cards remain usable during a feed outage. */
      });
    return () => controller.abort();
  }, []);
  return <LandingReadingCards stories={stories} />;
}
