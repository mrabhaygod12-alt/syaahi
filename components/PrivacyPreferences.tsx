"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";

type Choice = "essential" | "analytics";
const STORAGE_KEY = "syaahi-privacy-v1";

/** Optional measurement loads only after consent; account cookies are essential. */
export default function PrivacyPreferences() {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "essential" || saved === "analytics") setChoice(saved);
      else setOpen(true);
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
  }
  return (
    <>
      {ready && choice === "analytics" && <Analytics />}
      {ready && open && (
        <aside className="privacy-preferences" aria-label="Privacy preferences">
          <div>
            <strong>Your privacy preferences</strong>
            <p>
              Essential cookies keep you signed in. Optional Vercel Analytics
              measures page visits to help improve Syaahi.{" "}
              <a href="/cookies">Read the cookie policy</a>.
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
