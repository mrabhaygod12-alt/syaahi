export class RequestBudgetError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
/** Bound actual upload bytes and wall time, including chunked bodies. Never trust Content-Length. */
export async function enforceRequestBudget(
  req: Request,
  options: { limit?: number; timeoutMs?: number } = {},
) {
  const multipart = req.headers
    .get("content-type")
    ?.includes("multipart/form-data");
  const path = new URL(req.url).pathname;
  const limit =
    options.limit ??
    (multipart
      ? 12 * 1024 * 1024
      : /^\/api\/auth(?:\/|$)|^\/api\/reviews$/.test(path)
        ? 64 * 1024
        : 2 * 1024 * 1024);
  const declared = req.headers.get("content-length");
  if (
    declared !== null &&
    (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))
  )
    throw new RequestBudgetError(400, "Invalid request length.");
  if (Number(declared) > limit)
    throw new RequestBudgetError(
      413,
      "Request exceeds the supported upload size.",
    );
  if (!req.body) return;
  const reader = req.clone().body!.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new RequestBudgetError(
            408,
            "Upload took too long. Please retry with a stable connection.",
          ),
        ),
      options.timeoutMs ?? (multipart ? 30000 : 10000),
    );
  });
  let completed = false;
  try {
    let received = 0;
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) {
        completed = true;
        break;
      }
      received += value.byteLength;
      if (received > limit)
        throw new RequestBudgetError(
          413,
          "Request exceeds the supported upload size.",
        );
    }
  } finally {
    clearTimeout(timer);
    if (!completed) {
      void reader.cancel().catch(() => {});
      void req.body.cancel().catch(() => {});
    }
    reader.releaseLock();
  }
}
