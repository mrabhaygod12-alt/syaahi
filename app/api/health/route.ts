import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { useMongo, mongo } from "@/lib/storage/mongo";
async function handleGET() {
  try {
    let mongoOk = false;
    if (useMongo()) {
      const { database } = await mongo();
      await database.command({ ping: 1 });
      mongoOk = true;
    } else if (process.env.APP_ROLE === "backend") {
      return NextResponse.json(
        {
          ok: false,
          error: "DATA_BACKEND=mongo and MONGODB_URI are required",
          role: process.env.APP_ROLE,
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        app: "syaahi",
        mongo: mongoOk,
        role: process.env.APP_ROLE || "unspecified",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const errorMsg =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("Health check failure:", errorMsg);
    return NextResponse.json(
      {
        ok: false,
        error: errorMsg,
        role: process.env.APP_ROLE || "unspecified",
        hasMongoUri: !!process.env.MONGODB_URI,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = apiHandler(handleGET);
