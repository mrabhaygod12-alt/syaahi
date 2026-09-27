"use client";

import { useEffect, useState, useRef } from "react";
import { ANIME_AVATARS, getAnimeAvatar } from "@/lib/avatars";
import { refreshUser, type DemoUser } from "@/lib/auth/session";

interface FullProfile extends DemoUser {
  balance?: number;
  tokens?: number;
  referralCode?: string | null;
}

export default function ProfileView() {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [previewCustom, setPreviewCustom] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"avatar" | "details" | "security">("avatar");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.user);
          setName(data.user.name || "");
          const currentAv = data.user.avatar || getAnimeAvatar(data.user.id).id;
          setSelectedAvatar(currentAv);
          if (currentAv.startsWith("data:image/")) {
            setPreviewCustom(currentAv);
          }
        } else {
          const u = await refreshUser();
          if (u) {
            setProfile(u);
            setName(u.name || "");
            setSelectedAvatar(u.avatar || getAnimeAvatar(u.id).id);
          }
        }
      } catch {
        /* fallback */
      } finally {
        setLoading(false);
      }
    }
    void fetchProfile();
  }, []);

  async function handleSave() {
    setSaving(true);
    setStatusMsg(null);
    try {
      const avatarToSave = previewCustom || selectedAvatar;
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          avatar: avatarToSave,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile.");

      setProfile((prev) => (prev ? { ...prev, name: name.trim(), avatar: avatarToSave } : null));
      await refreshUser();
      setStatusMsg({ type: "success", text: "Profile updated successfully! ✨" });
    } catch (e) {
      setStatusMsg({
        type: "error",
        text: e instanceof Error ? e.message : "Update failed. Please retry.",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatusMsg({ type: "error", text: "Image must be under 2MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewCustom(dataUrl);
      setSelectedAvatar(dataUrl);
      setStatusMsg({ type: "success", text: "Custom image loaded! Click Save to apply." });
    };
    reader.readAsDataURL(file);
  }

  async function handleSendVerification() {
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send verification email.");
      setStatusMsg({
        type: "success",
        text: "Verification link sent to your email! Please check your inbox.",
      });
    } catch (e) {
      setStatusMsg({
        type: "error",
        text: e instanceof Error ? e.message : "Verification request failed.",
      });
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="wrap" style={{ padding: "80px 24px", maxWidth: 900, textAlign: "center" }}>
        <p className="small">Loading your profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="wrap" style={{ padding: "80px 24px", maxWidth: 600, textAlign: "center" }}>
        <h1>Sign In Required</h1>
        <p className="small">Please sign in to view and manage your profile settings.</p>
        <a href="/login" className="btn dark" style={{ marginTop: 20 }}>
          Sign In
        </a>
      </div>
    );
  }

  const currentAnime = getAnimeAvatar(selectedAvatar || profile.id);
  const isCustomImage = selectedAvatar?.startsWith("data:image/") || selectedAvatar?.startsWith("https://");

  return (
    <div className="wrap" style={{ maxWidth: 980, padding: "50px 20px 100px" }}>
      {/* Top Breadcrumb & Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <p className="small" style={{ textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280" }}>
            ACCOUNT & SETTINGS
          </p>
          <h1 style={{ margin: "4px 0 0", fontSize: "2rem" }}>Your Profile</h1>
        </div>
        <a href="/dashboard" className="btn light">
          ← Back to Dashboard
        </a>
      </div>

      {statusMsg && (
        <div
          role="status"
          style={{
            padding: "12px 18px",
            borderRadius: 8,
            marginBottom: 24,
            fontWeight: 600,
            fontSize: "0.95rem",
            background: statusMsg.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: statusMsg.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${statusMsg.type === "success" ? "#a7f3d0" : "#fecaca"}`,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Hero Profile Card */}
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 24,
          padding: 28,
          marginBottom: 32,
          background: "linear-gradient(145deg, #ffffff 0%, #f9f8f6 100%)",
          border: "1px solid #e5e0d8",
          borderRadius: 16,
          boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
        }}
      >
        {/* Big Avatar Preview */}
        <div style={{ position: "relative" }}>
          {isCustomImage ? (
            <img
              src={selectedAvatar}
              alt={profile.name}
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                objectFit: "cover",
                border: "3px solid #6246ea",
                boxShadow: "0 4px 12px rgba(98,70,234,0.25)",
              }}
            />
          ) : (
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: currentAnime.bg,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                border: `3px solid ${currentAnime.accent}`,
                boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
                fontSize: "2.4rem",
              }}
            >
              <span>{currentAnime.emoji}</span>
            </div>
          )}
          <span
            style={{
              position: "absolute",
              bottom: -4,
              right: -4,
              background: "#1f2937",
              color: "#fff",
              fontSize: "0.7rem",
              padding: "2px 8px",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            {isCustomImage ? "CUSTOM" : currentAnime.name}
          </span>
        </div>

        {/* User Details Header */}
        <div style={{ flex: "1 1 300px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "1.6rem" }}>{profile.name}</h2>
            {profile.verified ? (
              <span
                style={{
                  background: "#d1fae5",
                  color: "#065f46",
                  fontSize: "0.75rem",
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ✓ Email Verified
              </span>
            ) : (
              <span
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  fontSize: "0.75rem",
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ⚠ Unverified Email
              </span>
            )}
          </div>
          <p style={{ margin: "4px 0 8px", color: "#4b5563", fontSize: "0.95rem" }}>{profile.email}</p>
          <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.8rem" }}>
            Member since {new Date(profile.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} · ID: {profile.id.slice(0, 8)}...
          </p>
        </div>

        {/* Credits / Tokens Quick Card */}
        <div
          style={{
            padding: "16px 20px",
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e0d8",
            textAlign: "right",
            minWidth: 200,
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#6b7280", textTransform: "uppercase", fontWeight: 700 }}>
            Remaining Tokens
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#b45309", margin: "4px 0" }}>
            ⚡ {profile.tokens ?? Math.floor((profile.balance ?? 0) / 3)} Tokens
          </div>
          <div style={{ fontSize: "0.8rem", color: "#4b5563" }}>
            ({profile.balance ?? 0} Note Sections)
          </div>
          <a
            href="/pricing"
            style={{
              display: "inline-block",
              marginTop: 8,
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#6246ea",
              textDecoration: "underline",
            }}
          >
            + Get More Tokens
          </a>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: "flex",
          gap: 8,
          borderBottom: "2px solid #e5e0d8",
          marginBottom: 28,
        }}
      >
        <button
          onClick={() => setActiveTab("avatar")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 18px",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: "pointer",
            borderBottom: activeTab === "avatar" ? "3px solid #6246ea" : "3px solid transparent",
            color: activeTab === "avatar" ? "#6246ea" : "#6b7280",
            marginBottom: -2,
          }}
        >
          🎭 20 Anime Avatars & Custom Photo
        </button>
        <button
          onClick={() => setActiveTab("details")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 18px",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: "pointer",
            borderBottom: activeTab === "details" ? "3px solid #6246ea" : "3px solid transparent",
            color: activeTab === "details" ? "#6246ea" : "#6b7280",
            marginBottom: -2,
          }}
        >
          👤 Account Details
        </button>
        <button
          onClick={() => setActiveTab("security")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 18px",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: "pointer",
            borderBottom: activeTab === "security" ? "3px solid #6246ea" : "3px solid transparent",
            color: activeTab === "security" ? "#6246ea" : "#6b7280",
            marginBottom: -2,
          }}
        >
          🛡️ Security & Verification
        </button>
      </div>

      {/* TAB 1: 20 Anime Avatars & Custom Upload */}
      {activeTab === "avatar" && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Custom Photo Upload Section */}
          <div
            className="card"
            style={{
              padding: 24,
              border: "1px dashed #c4b5fd",
              background: "#faf5ff",
              borderRadius: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem" }}>Upload Your Custom Profile Photo</h3>
              <p className="small" style={{ margin: 0, color: "#6b7280" }}>
                Supports JPG, PNG or WebP under 2MB. Your photo will replace the avatar.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
              <button
                type="button"
                className="btn light"
                onClick={() => fileInputRef.current?.click()}
              >
                📁 Choose File
              </button>
              {previewCustom && (
                <button
                  type="button"
                  className="btn light"
                  style={{ color: "#dc2626" }}
                  onClick={() => {
                    setPreviewCustom(null);
                    setSelectedAvatar(getAnimeAvatar(profile.id).id);
                  }}
                >
                  ✕ Remove
                </button>
              )}
            </div>
          </div>

          {/* 20 Anime Character Avatars Grid */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Or Choose From 20 Iconic Anime Characters</h3>
              <span className="small" style={{ color: "#6b7280" }}>
                Click any character to select
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                gap: 14,
              }}
            >
              {ANIME_AVATARS.map((anime) => {
                const isSelected = selectedAvatar === anime.id;
                return (
                  <button
                    key={anime.id}
                    type="button"
                    onClick={() => {
                      setPreviewCustom(null);
                      setSelectedAvatar(anime.id);
                    }}
                    style={{
                      background: isSelected ? "#f5f3ff" : "#fff",
                      border: isSelected ? "2.5px solid #6246ea" : "1px solid #e5e0d8",
                      borderRadius: 12,
                      padding: 14,
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 4px 14px rgba(98,70,234,0.2)" : "none",
                      position: "relative",
                    }}
                  >
                    {isSelected && (
                      <span
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          background: "#6246ea",
                          color: "#fff",
                          fontSize: "0.7rem",
                          borderRadius: "50%",
                          width: 18,
                          height: 18,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                        }}
                      >
                        ✓
                      </span>
                    )}
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        background: anime.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.6rem",
                        margin: "0 auto 10px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                      }}
                    >
                      {anime.emoji}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#111827" }}>{anime.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2 }}>{anime.anime}</div>
                    <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 2, fontStyle: "italic" }}>
                      {anime.tagline}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Save Button */}
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn dark"
              disabled={saving}
              onClick={handleSave}
              style={{ padding: "12px 28px", fontSize: "1rem" }}
            >
              {saving ? "Saving..." : "Save Avatar Choice"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: Account Details */}
      {activeTab === "details" && (
        <div className="card" style={{ padding: 28, maxWidth: 640 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            style={{ display: "grid", gap: 20 }}
          >
            <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
              Full Name
              <input
                type="text"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
              Email Address (Account ID)
              <input
                type="email"
                value={profile.email}
                disabled
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#f3f4f6",
                  color: "#6b7280",
                }}
              />
              <span className="small" style={{ color: "#6b7280", fontWeight: 400 }}>
                Email cannot be changed directly for security and billing protection.
              </span>
            </label>

            {profile.referralCode && (
              <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
                Your Referral Code
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={profile.referralCode}
                    readOnly
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                      flex: 1,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                    }}
                  />
                  <button
                    type="button"
                    className="btn light"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/signup?ref=${profile.referralCode}`
                      );
                      setStatusMsg({ type: "success", text: "Referral invite link copied to clipboard! 📋" });
                    }}
                  >
                    Copy Link
                  </button>
                </div>
              </label>
            )}

            <button
              type="submit"
              className="btn dark"
              disabled={saving}
              style={{ width: "fit-content", padding: "10px 24px" }}
            >
              {saving ? "Saving Changes..." : "Save Details"}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Security & Verification */}
      {activeTab === "security" && (
        <div style={{ display: "grid", gap: 24, maxWidth: 640 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 10px" }}>Email Verification</h3>
            <p className="small" style={{ color: "#4b5563" }}>
              {profile.verified
                ? "Your email has been verified. You have full access to study note generation, PDF downloads, and referral rewards."
                : "Your email is unverified. Please verify your email to unlock all generation tools and secure your account."}
            </p>

            {!profile.verified && (
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn dark"
                  disabled={verifying}
                  onClick={handleSendVerification}
                >
                  {verifying ? "Sending..." : "Resend Verification Email"}
                </button>
                <a
                  href="/verify-email"
                  className="btn light"
                  style={{ marginLeft: 10 }}
                >
                  Enter Verification Code
                </a>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 10px" }}>Sign Out of All Sessions</h3>
            <p className="small" style={{ color: "#4b5563" }}>
              Need to switch devices or sign out safely? Click below.
            </p>
            <button
              type="button"
              className="btn light"
              style={{ color: "#dc2626", borderColor: "#fca5a5" }}
              onClick={async () => {
                const { signOut } = await import("@/lib/auth/session");
                await signOut();
                window.location.href = "/login";
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
