"use client";
import { growthEvent } from "@/lib/growth/events-client";
export default function ResourceLink({
  id,
  language = "english",
  label = "Download PDF",
}: {
  id: string;
  language?: string;
  label?: string;
}) {
  return (
    <a
      className="btn light"
      href={`/api/resources?id=${encodeURIComponent(id)}&language=${encodeURIComponent(language)}`}
      onClick={() => growthEvent("template_download")}
    >
      {label}
    </a>
  );
}
