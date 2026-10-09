export class ServiceRequestError extends Error {
  constructor(message: string, public status = 0, public reference?: string) {
    super(reference ? `${message} Reference: ${reference}.` : message);
    this.name = "ServiceRequestError";
  }
}
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
      const reference = response.headers.get("x-request-id") || response.headers.get("x-vercel-id");
      throw new ServiceRequestError(
        response.status === 413
          ? "This file or story exceeds the service's size limit. Use a smaller file or download your draft before shortening it."
          : response.status === 401 || response.status === 403
            ? "Your session could not be verified. Sign in again, then retry."
            : `The service returned an unexpected response (${response.status}). Your changes are still in this page. Retry shortly or contact support.`,
        response.status,
        reference && /^[a-z0-9:._-]{1,160}$/i.test(reference) ? reference : undefined,
      );
    }
    return { response, data };
  } catch (error) {
    if (controller.signal.aborted)
      throw new ServiceRequestError(
        "The request took too long. Please check your connection and try again.",
      );
    if (error instanceof TypeError)
      throw new ServiceRequestError(
        "Could not connect to Syaahi. Check your connection and try again.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
  }
}
