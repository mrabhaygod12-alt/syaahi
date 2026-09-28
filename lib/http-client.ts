/** Bounded JSON requests. Never display proxy HTML or replay a payment/login POST. */
export async function requestJson<T = Record<string, any>>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 20000,
): Promise<{ response: Response; data: T }> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    const response = await fetch(path, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    let data: T;
    try {
      data = JSON.parse(text);
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error();
    } catch {
      throw new Error(
        "Syaahi could not reach its service. Please try again shortly. If this continues, contact support.",
      );
    }
    return { response, data };
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "The request took too long. Please check your connection and try again.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Could not connect to Syaahi. Check your connection and try again.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
  }
}
