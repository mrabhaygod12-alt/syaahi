import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { useMongo, mongo } from "@/lib/storage/mongo";
import { releaseRevision } from "@/lib/release";
async function handleGET() {
  const revision = releaseRevision(
    process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA,
  );
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
          error: "The service is temporarily unavailable.",
          role: process.env.APP_ROLE,
          revision,
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        app: "syaahi",
        mongo: mongoOk,
        role: process.env.APP_ROLE || "unspecified",
        revision,
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
        error: "The service is temporarily unavailable.",
        role: process.env.APP_ROLE || "unspecified",
        revision,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = apiHandler(handleGET);
