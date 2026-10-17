import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { originError, AccountAccessError } from "@/lib/auth/server";
import { abuseGuard } from "@/lib/security/abuse";
import {
  enforceRequestBudget,
  RequestBudgetError,
} from "@/lib/security/request-budget";
import { admitRequest } from "@/lib/security/admission";
import { InputValidationError } from "@/lib/security/validation";
/** Keep infrastructure errors and credentials out of public responses. */
export function apiHandler<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
) {
  return async (...args: Parameters<T>): Promise<Response> => {
    const req = args[0] instanceof Request ? (args[0] as Request) : undefined;
    const requestId = randomUUID();
    const release = req ? admitRequest(req) : () => {};
    const decorate = (response: Response) => {
      response.headers.set("X-Request-Id", requestId);
      if (
        req &&
        new URL(req.url).pathname !== "/api/print-assets" &&
        !response.headers.has("Cache-Control")
      )
        response.headers.set("Cache-Control", "no-store");
      return response;
    };
    try {
      if (!release)
        return decorate(
          NextResponse.json(
            { error: "The service is busy. Please retry shortly.", requestId },
            { status: 503, headers: { "Retry-After": "3" } },
          ),
        );
      if (req) {
        const crossOrigin = originError(req);
        if (crossOrigin) return decorate(crossOrigin);
        const abuse = await abuseGuard(req);
        if (abuse) return decorate(abuse);
        await enforceRequestBudget(req);
      }
      return decorate(await handler(...args));
    } catch (error) {
      if (error instanceof InputValidationError)
        return decorate(
          NextResponse.json(
            { error: error.message, requestId },
            { status: 400 },
          ),
        );
      if (error instanceof RequestBudgetError)
        return decorate(
          NextResponse.json(
            { error: error.message, requestId },
            { status: error.status },
          ),
        );
      if (error instanceof AccountAccessError)
        return decorate(
          NextResponse.json(
            { error: error.message, code: "ACCOUNT_DISABLED" },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          ),
        );
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
    } finally {
      release?.();
    }
  };
}
