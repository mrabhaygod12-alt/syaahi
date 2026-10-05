"use client";
import { useEffect, useState } from "react";
import SlideCanvas from "./SlideCanvas";
import type {
  DeckSlide,
  DeckTemplate,
  BrandKit,
} from "@/lib/presentations/model";
import "./presentation-studio.css";
export default function AudienceView() {
  const [view, setView] = useState<{
    slide: DeckSlide;
    template: DeckTemplate;
    brand?: BrandKit;
    index: number;
  } | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("channel");
    if (!token || !/^[-a-f0-9]{36}$/.test(token)) return;
    const channel = new BroadcastChannel("syaahi-audience:" + token);
    channel.onmessage = (e) => {
      if (e.data?.type === "slide") setView(e.data.view);
      if (e.data?.type === "closed") setView(null);
    };
    channel.postMessage({ type: "ready" });
    return () => channel.close();
  }, []);
  return (
    <section className="audience-window" aria-label="Audience presentation">
      {view ? (
        <SlideCanvas {...view} />
      ) : (
        <p>
          Waiting for the presenter. Open this window from the studio’s Present
          controls.
        </p>
      )}
    </section>
  );
}
