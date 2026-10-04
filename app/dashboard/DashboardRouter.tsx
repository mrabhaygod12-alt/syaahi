"use client";
import { useEffect, useState } from "react";
import DashboardClient from "./DashboardClient";
import { requestJson } from "@/lib/http-client";
export default function DashboardRouter() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (
      new URLSearchParams(location.search).get("view") === "student" ||
      location.search.includes("topic=")
    ) {
      setReady(true);
      return;
    }
    requestJson("/api/auth")
      .then(({ data }) => {
        if (data.user?.workspace === "writer") location.replace("/writer");
        else setReady(true);
      })
      .catch(() => setReady(true));
  }, []);
  return ready ? (
    <DashboardClient />
  ) : (
    <div className="wrap">
      <p role="status">Opening your workspace…</p>
    </div>
  );
}
