"use client";

import { useEffect, useState } from "react";

const languages = [
  ["english", "EN"],
  ["hindi", "हि"],
  ["hinglish", "HI"],
  ["german", "DE"],
  ["french", "FR"],
  ["spanish", "ES"],
] as const;

export default function LanguageControl() {
  const [locale, setLocale] = useState("english");
  useEffect(() => {
    const saved = localStorage.getItem("syaahi-note-language");
    if (languages.some(([id]) => id === saved)) setLocale(saved!);
  }, []);
  return <select
    aria-label="Preferred language"
    value={locale}
    onChange={(event) => {
      const next = event.target.value;
      setLocale(next);
      localStorage.setItem("syaahi-note-language", next);
      fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      }).catch(() => {});
    }}
  >
    {languages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
  </select>;
}
