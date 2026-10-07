"use client";
import { useEffect } from "react";
import { growthEvent } from "@/lib/growth/events-client";
import { usePathname } from "next/navigation";
export default function GrowthVisit() {
  const path = usePathname();
  useEffect(() => {
    let measured = false;
    const visit = () => {
      if (measured || localStorage.getItem("syaahi-privacy-v1") !== "analytics")
        return;
      measured = true;
      growthEvent("visit");
    };
    visit();
    window.addEventListener("syaahi:measurement-ready", visit);
    return () => window.removeEventListener("syaahi:measurement-ready", visit);
  }, [path]);
  return null;
}
