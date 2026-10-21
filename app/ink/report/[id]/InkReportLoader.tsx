"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../client";
import type { InkReport } from "../../types";
import InkReportView from "./InkReportView";
export default function InkReportLoader({ id }: { id: string }) {
  const [report, setReport] = useState<InkReport | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ report: InkReport }>(`/api/ink?id=${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(({ data }) => setReport(data.report)).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id]);
  if (report) return <InkReportView report={report} />;
  return <main className="ink-page"><p role={error ? "alert" : "status"}>{error || "Loading your private report…"}</p><Link href="/ink/reports">All reports</Link></main>;
}
