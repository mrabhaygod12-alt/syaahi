import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { useMongo, mongo } from "@/lib/storage/mongo";
async function handleGET() {
  try {
    if (useMongo()) await (await mongo()).database.command({ ping: 1 });
    else if (process.env.APP_ROLE === "backend")
      return NextResponse.json(
        { ok: false, error: "DATA_BACKEND=mongo and MONGODB_URI are required" },
        { status: 503 },
      );
    return NextResponse.json(
      { ok: true, app: "syaahi" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

export const GET = apiHandler(handleGET);
