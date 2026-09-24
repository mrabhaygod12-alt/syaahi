import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { printAssets } from "@/lib/pdf/server";
export const runtime = "nodejs";
async function handleGET() {
  return NextResponse.json(printAssets(), {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}

export const GET = apiHandler(handleGET);
