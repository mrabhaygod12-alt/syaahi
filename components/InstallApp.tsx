"use client";
import { useEffect, useState } from "react";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export default function InstallApp() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const receive = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", receive);
    return () => window.removeEventListener("beforeinstallprompt", receive);
  }, []);
  if (!event) return null;
  return (
    <button
      className="install-app"
      onClick={async () => {
        await event.prompt();
        await event.userChoice;
        setEvent(null);
      }}
    >
      Install Syaahi ↗
    </button>
  );
}
