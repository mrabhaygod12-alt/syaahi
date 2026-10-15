import { requestJson } from "@/lib/http-client";
import type { VideoJob } from "./jobs";
export async function prepareVideo(
  url: string,
  progress: (message: string) => void,
  signal?: AbortSignal,
) {
  let { response, data } = await requestJson(
    "/api/youtube",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal,
    },
    20000,
  );
  if (!response.ok)
    throw new Error(data.error || "Could not queue this lecture.");
  const deadline = Date.now() + 8 * 60_000;
  while (data.status !== "done") {
    if (["needs_input", "error", "cancelled"].includes(data.status))
      throw new Error(data.error || "Upload your lecture source to continue.");
    if (Date.now() > deadline)
      throw new Error(
        "Your video is still queued. Select Prepare again to resume; it will reuse the saved job.",
      );
    progress(
      data.status === "assessing"
        ? "Checking teaching content…"
        : data.status === "reading"
          ? "Reading captions or public video… You can resume this job later."
          : "Lecture queued… Waiting for the processing service.",
    );
    await new Promise<void>((resolve, reject) => {
      const stop = () => {
        clearTimeout(timer);
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", stop);
        resolve();
      }, 3000);
      signal?.addEventListener("abort", stop, { once: true });
      if (signal?.aborted) stop();
    });
    ({ response, data } = await requestJson(
      `/api/youtube/${encodeURIComponent(data.id)}`,
      { signal },
      20000,
    ));
    if (!response.ok)
      throw new Error(
        data.error || "Processing is saved. Prepare again to resume.",
      );
  }
  return data.result as NonNullable<VideoJob["result"]>;
}
