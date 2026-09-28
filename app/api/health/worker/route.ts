import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { collection, useMongo } from "@/lib/storage/mongo";

// Public, secret-free liveness signal for the separate generation worker.
// Point an uptime monitor here in addition to /api/health.
async function handleGET() {
  if (!useMongo())
    return NextResponse.json({ ok: true, worker: "local-or-embedded" });
  try {
    const heartbeat = await (
      await collection("system_state")
    ).findOne({ _id: "generation_worker" });
    const seenAt = heartbeat?.seenAt ? new Date(heartbeat.seenAt).getTime() : 0;
    const ageMs = seenAt ? Math.max(0, Date.now() - seenAt) : null;
    const ok = ageMs !== null && ageMs < 45_000;
    return NextResponse.json(
      { ok, worker: ok ? "running" : "not-reporting", ageMs },
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
      { ok: false, worker: "unknown" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = apiHandler(handleGET);
