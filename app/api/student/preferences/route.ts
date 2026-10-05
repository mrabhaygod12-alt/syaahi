import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { readState, mutateState } from "@/lib/study/state";
import {
  readerDefaults,
  validateReader,
  type ReaderPreferences,
} from "@/lib/study/preferences";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  return NextResponse.json({
    reader: await readState(
      (await currentUser(req))!.id,
      "reader",
      readerDefaults(),
    ),
  });
});
export const PATCH = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "reader-save", 30, 60000));
  if (denied) return denied;
  const owner = (await currentUser(req))!.id,
    b = await req.json().catch(() => ({}));
  try {
    const reader = await mutateState<ReaderPreferences>(
      owner,
      "reader",
      readerDefaults(),
      (old) => {
        if (b.revision !== old.revision)
          throw new Error(
            "Reading preferences changed on another device. Reload preferences before saving.",
          );
        return validateReader(b, old.revision + 1);
      },
    );
    return NextResponse.json({ reader });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save preferences." },
      { status: 409 },
    );
  }
});
