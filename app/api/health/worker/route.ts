import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { collection, useMongo } from "@/lib/storage/mongo";

// Public liveness only. Detailed topology is available through the MFA admin API.
async function handleGET() {
  if (!useMongo()) return NextResponse.json({ ok: true });
  try {
    const heartbeat = await (
      await collection("system_state")
    ).findOne({ _id: "generation_worker" });
    const seenAt = heartbeat?.seenAt ? new Date(heartbeat.seenAt).getTime() : 0;
    const ageMs = seenAt ? Math.max(0, Date.now() - seenAt) : null;
    const ok = ageMs !== null && ageMs < 45_000;
    return NextResponse.json(
      { ok },
      {
        status: ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Worker health check failure:", {
      kind: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = apiHandler(handleGET);
