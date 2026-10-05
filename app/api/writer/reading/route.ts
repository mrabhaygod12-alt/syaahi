import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { following, readingLibrary } from "@/lib/writing/social";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  const owner = (await currentUser(req))!.id;
  const [writers, reading] = await Promise.all([
    following(owner),
    readingLibrary(owner),
  ]);
  return NextResponse.json({
    writers: writers.map(({ slug, name }) => ({ slug, name })),
    reading,
  });
});
