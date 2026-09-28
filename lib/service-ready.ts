import { requestJson } from "./http-client";

/** Wake an idle API before sending credentials. Only the read-only health GET repeats. */
export async function waitForService(
  signal?: AbortSignal,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    requestTimeoutMs?: number;
  } = {},
) {
  const deadline = Date.now() + (options.timeoutMs ?? 90000);
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("Sign-in cancelled.");
    try {
      const { response, data } = await requestJson(
        "/api/health",
        { signal },
        Math.min(options.requestTimeoutMs ?? 12000, deadline - Date.now()),
      );
      if (response.ok && data.ok === true && data.app === "syaahi") return;
      // Configuration/access errors cannot be repaired by waiting for startup.
      if (response.status === 401 || response.status === 403) break;
    } catch {
      if (signal?.aborted) throw new Error("Sign-in cancelled.");
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(
        done,
        Math.min(options.intervalMs ?? 2000, remaining),
      );
      signal?.addEventListener("abort", done, { once: true });
      if (signal?.aborted) done();
    });
  }
  throw new Error(
    "The sign-in service is still unavailable. Your login was not submitted. Please try again in a minute.",
  );
}
