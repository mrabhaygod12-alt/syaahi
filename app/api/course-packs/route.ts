import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { COURSE_PACKS } from "@/lib/course-packs";

async function handleGET() {
  return NextResponse.json({ coursePacks: COURSE_PACKS }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
export const GET = apiHandler(handleGET);
