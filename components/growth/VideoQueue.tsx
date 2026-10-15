"use client";
import { useEffect, useState } from "react";
import { Video, CircleCheck, Clock3 } from "lucide-react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "@/components/WorkspaceProvider";
import { learningLink } from "@/lib/growth/samples";
const live = ["queued", "reading", "assessing"];
export default function VideoQueue() {
  const { user } = useAccount();
  const [jobs, setJobs] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    setJobs([]);
    setError("");
    if (!user) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const { response, data } = await requestJson("/api/youtube", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!response.ok || !Array.isArray(data.jobs))
          throw new Error("Could not check lecture imports. Reload to retry.");
        setJobs(data.jobs);
        setError("");
        timer = setTimeout(
          poll,
          data.jobs.some((job: any) => live.includes(job.status))
            ? 5000
            : 15000,
        );
      } catch {
        if (!controller.signal.aborted)
          setError(
            "Lecture import status is temporarily unavailable. Reload to retry.",
          );
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [user?.id]);
  if (!jobs.length && !error) return null;
  return (
    <section className="hub-video-queue" aria-label="Recent lecture imports">
      <header>
        <Video size={20} aria-hidden="true" />
        <h2>Recent lecture imports</h2>
        <small>Saved for your account · last 24 hours</small>
      </header>
      {error && <p role="status">{error}</p>}
      {jobs.map((job) => (
        <article key={job.id}>
          <span className="hub-video-icon">
            {job.status === "done" ? (
              <CircleCheck size={18} aria-hidden="true" />
            ) : (
              <Clock3 size={18} aria-hidden="true" />
            )}
          </span>
          <div>
            <strong>{job.title}</strong>
            <small style={{ overflowWrap: "anywhere" }}>{job.url}</small>
            <span>
              {job.status === "done"
                ? "Source ready to review"
                : job.status.replaceAll("_", " ")}
            </span>
            {job.error && <small>{job.error}</small>}
          </div>
          <a href={learningLink(job.url)}>
            {job.status === "done" ? "Review source" : "Resume"} →
          </a>
          {live.includes(job.status) && (
            <button
              type="button"
              disabled={!!busy}
              onClick={async () => {
                setBusy(job.id);
                setError("");
                try {
                  const { response, data } = await requestJson(
                    `/api/youtube/${job.id}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "cancel" }),
                    },
                  );
                  if (!response.ok) throw new Error(data.error);
                  setJobs((old) =>
                    old.map((item) =>
                      item.id === job.id ? { ...item, ...data } : item,
                    ),
                  );
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not stop processing.",
                  );
                } finally {
                  setBusy("");
                }
              }}
            >
              {busy === job.id ? "Stopping…" : "Stop"}
            </button>
          )}
        </article>
      ))}
      <p>
        Preparing the same link resumes its saved job. Stopping prevents further
        workflow stages; an in-flight provider request may finish.
      </p>
    </section>
  );
}
