"use client";
import { useEffect, useState } from "react";
import { refreshUser, signOut, type DemoUser } from "@/lib/auth/session";

// Turbo-style header identity: gold Upgrade pill + avatar circle when signed in.
export default function UserChip() {
  const [user, setUser] = useState<DemoUser | null | undefined>(undefined);
  useEffect(() => {
    refreshUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  if (user === undefined) {
    return <div className="account-skeleton" aria-label="Loading account" />;
  }
  if (!user) {
    return (
      <div style={{ display: "flex", gap: 8, whiteSpace: "nowrap" }}>
        <a className="btn light" href="/login">
          Log in
        </a>
        <a className="btn dark" href="/signup">
          Get started
        </a>
      </div>
    );
  }
  const initial = (user.name || user.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      <a
        className="btn dark"
        style={{ background: "#b45309", borderColor: "#b45309" }}
        href="/pricing"
      >
        ✨ Upgrade
      </a>
      <button
        title={`${user.name} (${user.email}) — click to sign out`}
        onClick={async () => {
          await signOut();
          window.location.href = "/";
        }}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid #d9d1c7",
          background: "#efedfc",
          color: "#6246ea",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {initial}
      </button>
    </div>
  );
}
