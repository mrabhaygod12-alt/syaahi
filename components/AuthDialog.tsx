"use client";
import { useEffect, useState } from "react";
import AuthForm from "./AuthForm";
import Modal from "./Modal";
export default function AuthDialog() {
  const [url, setUrl] = useState<URL | null>(null);
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const next = new URL(anchor.href, location.origin);
      if (
        next.origin !== location.origin ||
        !["/login", "/signup"].includes(next.pathname) ||
        ["/login", "/signup"].includes(location.pathname)
      )
        return;
      e.preventDefault();
      setUrl(next);
    };
    // Capture before Next Link handles navigation so both link types open the dialog.
    document.addEventListener("click", handle, true);
    return () => document.removeEventListener("click", handle, true);
  }, []);
  if (!url) return null;
  return (
    <Modal
      title={url.pathname === "/signup" ? "Create your account" : "Log in"}
      onClose={() => setUrl(null)}
    >
      <AuthForm
        key={url.href}
        mode={url.pathname === "/signup" ? "signup" : "login"}
        compact
        params={url.search}
        onModeChange={(href) => setUrl(new URL(href, location.origin))}
      />
    </Modal>
  );
}
