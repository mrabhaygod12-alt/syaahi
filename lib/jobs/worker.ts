import { processPendingVideo } from "@/lib/youtube/jobs";
import { kickPlanTasks } from "@/lib/presentations/hybrid/tasks";
import { kickMedia, cleanExpiredMedia } from "@/lib/presentations/hybrid/media";
import { workerConcurrency } from "./capacity";
import { pendingJobs } from "./store";
import { processJob } from "./runner";
import { collection, useMongo } from "@/lib/storage/mongo";
import { deliverStudyReminders } from "@/lib/study/reminders";
import { indexDocumentBatch } from "@/lib/documents/vectors";
import { processPendingDeck } from "@/lib/presentations/store";
import { publishDueStories } from "@/lib/writing/publishing";
import { processPendingAssignments } from "@/lib/assignments/engine";
const state = globalThis as unknown as {
  syaahiWorker?: ReturnType<typeof setInterval>;
  syaahiHeartbeat?: ReturnType<typeof setInterval>;
  syaahiTick?: boolean;
  syaahiReminderTick?: number;
};
async function recordWorkerHeartbeat() {
  if (!useMongo()) return;
  try {
    await (
      await collection("system_state")
    ).updateOne(
      { _id: "generation_worker" },
      { $set: { seenAt: new Date(), role: "worker" } },
      { upsert: true },
    );
  } catch {
    // Job processing still runs if the diagnostic write is temporarily down.
  }
}
export function kickWorker(standalone = false) {
  if (process.env.WORKER_MODE === "external" && !standalone) return;
  const tick = async () => {
    if (state.syaahiTick) return;
    state.syaahiTick = true;
    try {
      await publishDueStories();
      kickPlanTasks();
      kickMedia();
      await cleanExpiredMedia();
      await Promise.all([
        Promise.all(
          (await pendingJobs()).slice(0, workerConcurrency()).map(processJob),
        ),
        processPendingAssignments(),
      ]);
      await processPendingDeck();
      await processPendingVideo();
      if (standalone) await indexDocumentBatch();
      // Email reminders are deliberately throttled; generation keeps priority.
      if (
        standalone &&
        Date.now() - (state.syaahiReminderTick || 0) > 15 * 60_000
      ) {
        state.syaahiReminderTick = Date.now();
        const result = await deliverStudyReminders();
        if (result.delivered)
          console.info(`Delivered ${result.delivered} study reminder(s).`);
      }
    } catch (error) {
      console.error(
        "Worker tick failed",
        error instanceof Error ? error.message : "unknown",
      );
    } finally {
      state.syaahiTick = false;
    }
  };
  // Keep liveness independent from queue work. A long provider request should
  // not make a healthy worker look offline just because its job tick is busy.
  if (standalone && !state.syaahiHeartbeat) {
    void recordWorkerHeartbeat();
    state.syaahiHeartbeat = setInterval(() => {
      void recordWorkerHeartbeat();
    }, 15_000);
    state.syaahiHeartbeat.unref();
  }
  if (!state.syaahiWorker) {
    state.syaahiWorker = setInterval(tick, 5000);
    state.syaahiWorker.unref();
  }
  void tick();
}
