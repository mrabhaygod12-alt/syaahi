import { workerConcurrency } from "./capacity";
import { pendingJobs } from "./store";
import { processJob } from "./runner";
const state = globalThis as unknown as {
  syaahiWorker?: ReturnType<typeof setInterval>;
  syaahiTick?: boolean;
};
export function kickWorker(standalone = false) {
  if (process.env.WORKER_MODE === "external" && !standalone) return;
  const tick = async () => {
    if (state.syaahiTick) return;
    state.syaahiTick = true;
    try {
      await Promise.all(
        (await pendingJobs()).slice(0, workerConcurrency()).map(processJob),
      );
    } catch (error) {
      console.error(
        "Worker tick failed",
        error instanceof Error ? error.message : "unknown",
      );
    } finally {
      state.syaahiTick = false;
    }
  };
  if (!state.syaahiWorker) {
    state.syaahiWorker = setInterval(tick, 5000);
    state.syaahiWorker.unref();
  }
  void tick();
}
