import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { useMongo, mongo } from "@/lib/storage/mongo";
async function handleGET() {
  try {
    if (useMongo()) {
      const { database } = await mongo();
      await database.command({ ping: 1 });
    } else if (process.env.APP_ROLE === "backend") {
      return NextResponse.json(
        {
          ok: false,
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      {
        ok: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("Health check failure:", {
      kind: err instanceof Error ? err.name : "unknown",
    });
    return NextResponse.json(
      {
        ok: false,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = apiHandler(handleGET);
