"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { requestJson } from "@/lib/http-client";

type Choice = "essential" | "analytics";
const STORAGE_KEY = "syaahi-privacy-v1";
async function syncChoice(value: Choice) {
  try {
    const r = await requestJson("/api/growth/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowed: value === "analytics" }),
    });
    if (r.response.ok) {
      sessionStorage.setItem("syaahi-hero-variant", r.data.variant || "A");
      window.dispatchEvent(new Event("syaahi:measurement-ready"));
    }
  } catch {
    /* Optional measurement never blocks the app. */
  }
}

/** Optional measurement loads only after consent; account cookies are essential. */
export default function PrivacyPreferences() {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "essential" || saved === "analytics") {
        setChoice(saved);
        void syncChoice(saved);
      } else setOpen(true);
    } catch {
      setOpen(true);
    }
    setReady(true);
    const show = () => setOpen(true);
    window.addEventListener("syaahi:privacy-settings", show);
    return () => window.removeEventListener("syaahi:privacy-settings", show);
  }, []);
  function save(value: Choice) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* choice remains for this visit */
    }
    setChoice(value);
    setOpen(false);
    void syncChoice(value);
  }
  return (
    <>
      {ready && choice === "analytics" && <Analytics />}
      {ready && open && (
        <aside className="privacy-preferences" aria-label="Privacy preferences">
          <div>
            <strong>Your privacy preferences</strong>
            <p>
              Essential cookies keep you signed in. Optional analytics measures
              visits and product usage, without note text or topics, to improve
              Syaahi. <a href="/cookies">Read the cookie policy</a>.
            </p>
          </div>
          <div className="privacy-actions">
            <button className="btn light" onClick={() => save("essential")}>
              Essential only
            </button>
            <button className="btn dark" onClick={() => save("analytics")}>
              Allow analytics
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
