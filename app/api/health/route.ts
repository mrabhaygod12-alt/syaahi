import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { useMongo, mongo } from "@/lib/storage/mongo";
async function handleGET() {
  try {
    if (useMongo()) await (await mongo()).database.command({ ping: 1 });
    return NextResponse.json(
      { ok: true, app: "syaahi" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

export const GET = apiHandler(handleGET);
