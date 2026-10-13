import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { indexCursor, listPublicationIndex } from "@/lib/writing/public-index";

export const GET = apiHandler(async (req: NextRequest) => {
  const cursor = req.nextUrl.searchParams.get("cursor");
  try {
    indexCursor(cursor);
  } catch {
    return NextResponse.json(
      { error: "Invalid publication index cursor." },
      { status: 400 },
    );
  }
  return NextResponse.json(await listPublicationIndex(cursor), {
    headers: { "Cache-Control": "no-store" },
  });
});
