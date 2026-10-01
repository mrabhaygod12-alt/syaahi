import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { originError } from "@/lib/auth/server";
/** Keep infrastructure errors and credentials out of public responses. */
export function apiHandler<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
) {
  return async (...args: Parameters<T>): Promise<Response> => {
    const req = args[0] instanceof Request ? (args[0] as Request) : undefined;
    const requestId = randomUUID();
    try {
      if (req) {
        const crossOrigin = originError(req);
        if (crossOrigin) return crossOrigin;
        const bytes = Number(req.headers.get("content-length") || 0);
        const limit = req.headers
          .get("content-type")
          ?.includes("multipart/form-data")
          ? 12 * 1024 * 1024
          : 2 * 1024 * 1024;
        if (bytes > limit)
          return NextResponse.json(
            { error: "Request exceeds the supported upload size.", requestId },
            { status: 413 },
          );
        // Enforce the actual streamed bytes too: Content-Length is optional and
        // untrusted. The original body remains available to the route handler.
        if (req.body) {
          const reader = req.clone().body!.getReader();
          let received = 0;
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              received += value.byteLength;
              if (received > limit) {
                void reader.cancel().catch(() => {});
                return NextResponse.json(
                  {
                    error: "Request exceeds the supported upload size.",
                    requestId,
                  },
                  { status: 413 },
                );
              }
            }
          } finally {
            reader.releaseLock();
          }
        }
      }
      const response = await handler(...args);
      response.headers.set("X-Request-Id", requestId);
      if (
        req &&
        new URL(req.url).pathname !== "/api/print-assets" &&
        !response.headers.has("Cache-Control")
      )
        response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "api_failure",
          requestId,
          path: req ? new URL(req.url).pathname : "unknown",
          kind: error instanceof Error ? error.name : "unknown",
        }),
      );
      return NextResponse.json(
        {
          error:
            "This request could not be completed. Please retry. If it continues, include this reference in a support ticket.",
          requestId,
        },
        {
          status: 503,
          headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
        },
      );
    }
  };
}
