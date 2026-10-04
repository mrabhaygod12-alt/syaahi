import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { writerAccess } from "@/lib/writing/profile";
import { savedGuides } from "@/lib/writing/engagement";
import { publicStoryViews } from "@/lib/writing/public";
export const GET = apiHandler(async (req: Request) => {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const access = await writerAccess(user.id);
  if (access) return access;
  return NextResponse.json({
    stories: await publicStoryViews(await savedGuides(user.id)),
  });
});
