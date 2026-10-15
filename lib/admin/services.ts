import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
import { eligibleProviders } from "@/lib/ai/providers";
import { breakerStatus } from "@/lib/ai/router";
export async function serviceStatus() {
  const states = ["queued", "reading", "assessing"];
  const queue = useMongo()
    ? await (
        await collection("workspace_records")
      ).countDocuments({
        kind: "video-ingestion",
        "payload.status": { $in: states },
      })
    : Number(
        db()
          .prepare(
            "SELECT COUNT(*) AS n FROM workspace_records WHERE kind='video-ingestion' AND json_extract(payload,'$.status') IN ('queued','reading','assessing')",
          )
          .get()?.n || 0,
      );
  const heartbeat = useMongo()
    ? (
        await (
          await collection("system_state")
        ).findOne({ _id: "generation_worker" })
      )?.seenAt
    : null;
  const seen = heartbeat ? new Date(heartbeat).toISOString() : null;
  const breakers = breakerStatus();
  return {
    videoQueue: queue,
    worker: {
      mode: process.env.WORKER_MODE === "external" ? "external" : "embedded",
      lastSeenAt: seen,
      heartbeatFresh: Boolean(
        seen && Date.now() - Date.parse(seen) < 10 * 60_000,
      ),
    },
    providers: eligibleProviders().map((p) => ({
      id: p.id,
      type: p.type,
      model: p.model,
      status: breakers[p.type]?.cooldownMs > 0 ? "cooling down" : "configured",
      cooldownMs: breakers[p.type]?.cooldownMs || 0,
    })),
    videoReadingConfigured: Boolean(
      process.env.GEMINI_API_KEY &&
      process.env.ENABLE_YOUTUBE_VIDEO_FALLBACK !== "false",
    ),
  };
}
