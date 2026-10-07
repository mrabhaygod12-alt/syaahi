"use client";
export type GrowthEvent =
  | "visit"
  | "preview_start"
  | "preview_ready"
  | "signup_start"
  | "template_download"
  | "referral_share"
  | "note_share";
export function growthEvent(event: GrowthEvent) {
  try {
    if (localStorage.getItem("syaahi-privacy-v1") !== "analytics") return;
    void fetch("/api/growth/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, id: crypto.randomUUID() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Measurement never blocks learning. */
  }
}
