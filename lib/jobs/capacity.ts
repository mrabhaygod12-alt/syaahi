/** Bounded deployment settings; invalid values retain safe defaults. */
export function boundedSetting(
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}
export const workerConcurrency = () =>
  boundedSetting("WORKER_CONCURRENCY", 2, 1, 4);
export const pageConcurrency = () =>
  boundedSetting("PAGE_CONCURRENCY", 2, 1, 3);
export const activeJobLimit = () =>
  boundedSetting("MAX_ACTIVE_JOBS_PER_USER", 3, 1, 20);
export class QueueCapacityError extends Error {
  constructor() {
    super(
      "You already have several lessons generating. Wait for one to finish before starting another.",
    );
    this.name = "QueueCapacityError";
  }
}
