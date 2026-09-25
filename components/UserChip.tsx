"use client";

import { useEffect, useState, useRef } from "react";
import { refreshUser, signOut, type DemoUser } from "@/lib/auth/session";
import { getAnimeAvatar } from "@/lib/avatars";

export default function UserChip() {
  const [user, setUser] = useState<DemoUser | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshUser()
      .then((u) => {
        setUser(u);
        if (u) {
          fetch("/api/credits")
            .then((r) => r.json())
            .then((d) =>
              setTokens(
                Number(Number(d.tokens ?? (d.balance ?? 0) / 3).toFixed(2)),
              ),
            )
            .catch(() => {});
        }
      })
      .catch(() => setUser(null));

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const anime = getAnimeAvatar(user.avatar || user.id);
  const isCustomImage =
    user.avatar?.startsWith("data:image/") ||
    user.avatar?.startsWith("https://");

  return (
    <div
      ref={dropdownRef}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        whiteSpace: "nowrap",
        position: "relative",
      }}
    >
      <a
        className="btn dark"
        style={{
          background: "#b45309",
          borderColor: "#b45309",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
        href="/pricing"
      >
        <span>✨ Upgrade</span>
        {tokens !== null && (
          <span
            style={{
              background: "rgba(255,255,255,0.2)",
              padding: "1px 6px",
              borderRadius: 10,
              fontSize: "0.75rem",
              fontWeight: 800,
            }}
          >
            {tokens}T
          </span>
        )}
      </a>

      {/* Avatar Button triggers dropdown */}
      <button
        type="button"
        title={`${user.name} (${user.email}) — Click for profile & settings`}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: open ? "2px solid #6246ea" : "1.5px solid #d9d1c7",
          background: isCustomImage ? "#fff" : anime.bg,
          color: "#fff",
          fontWeight: 800,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: isCustomImage ? "1rem" : "1.1rem",
          padding: 0,
          overflow: "hidden",
          transition: "all 0.15s ease",
          boxShadow: open ? "0 0 0 3px rgba(98, 70, 234, 0.25)" : "none",
        }}
      >
        {isCustomImage ? (
          <img
            src={user.avatar!}
            alt={user.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span>{anime.emoji}</span>
        )}
      </button>

      {/* Profile Dropdown Menu */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 260,
            background: "#ffffff",
            borderRadius: 14,
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
            border: "1px solid #e5e0d8",
            padding: 12,
            zIndex: 9999,
            display: "grid",
            gap: 8,
            animation: "fadeIn 0.15s ease",
          }}
        >
          {/* User Info Header in Dropdown */}
          <div
            style={{
              padding: "8px 10px 10px",
              borderBottom: "1px solid #f3f4f6",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: isCustomImage ? "#fff" : anime.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {isCustomImage ? (
                <img
                  src={user.avatar!}
                  alt={user.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span>{anime.emoji}</span>
              )}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  color: "#111827",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.name}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.email}
              </div>
            </div>
          </div>

          {/* Tokens & Verification Badges */}
          <div
            style={{
              padding: "6px 10px",
              background: "#f9fafb",
              borderRadius: 8,
              fontSize: "0.8rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#b45309", fontWeight: 700 }}>
              ⚡ {tokens !== null ? `${tokens} Tokens` : "Study Tokens"}
            </span>
            {user.verified ? (
              <span
                style={{
                  color: "#059669",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                }}
              >
                ✓ Verified
              </span>
            ) : (
              <a
                href="/verify-email"
                style={{
                  color: "#d97706",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  textDecoration: "underline",
                }}
              >
                Verify Email
              </a>
            )}
          </div>

          {/* Navigation Links */}
          <div style={{ display: "grid", gap: 2 }}>
            <a
              href="/profile"
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: "0.88rem",
                color: "#1f2937",
                fontWeight: 600,
                textDecoration: "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f3f4f6")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span>👤</span> Profile & Settings
            </a>

            <a
              href="/dashboard"
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: "0.88rem",
                color: "#1f2937",
                fontWeight: 600,
                textDecoration: "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f3f4f6")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span>✦</span> Study Dashboard
            </a>

            <a
              href="/refer"
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: "0.88rem",
                color: "#1f2937",
                fontWeight: 600,
                textDecoration: "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f3f4f6")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span>↗</span> Invite & Earn Credits
            </a>

            <a
              href="/pricing"
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: "0.88rem",
                color: "#1f2937",
                fontWeight: 600,
                textDecoration: "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f3f4f6")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span>💳</span> Pricing & Packs
            </a>
          </div>

          <div style={{ height: 1, background: "#f3f4f6", margin: "2px 0" }} />

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
              window.location.href = "/";
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: "0.88rem",
              color: "#dc2626",
              fontWeight: 600,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
