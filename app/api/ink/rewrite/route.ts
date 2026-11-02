import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { inkAccount } from "@/lib/ink/access";
export const runtime = "nodejs";
/** Explicit tombstone for stale clients. No provider call occurs. */
export const POST = apiHandler(async (req: NextRequest) => {
  const access = await inkAccount(req);
  if (access.response) return access.response;
  return NextResponse.json(
    {
      error:
        "AI Ink now provides document checking and evidence reports. The editing service has been retired.",
      code: "INK_EDITING_RETIRED",
    },
    { status: 410 },
  );
});
