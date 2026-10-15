import { createHash, randomUUID } from "node:crypto";
import {
  mutateRecord,
  record,
  records,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
import { fetchYouTube, videoId } from "./transcript";
import { assessVideo } from "./study";
import { assertAccountActive } from "@/lib/auth/server";

export interface VideoJob extends WorkspaceRecord {
  kind: "video-ingestion";
  url: string;
  status:
    | "queued"
    | "reading"
    | "assessing"
    | "done"
    | "needs_input"
    | "error"
    | "cancelled";
  createdAt: string;
  attempts: number;
  lease?: string;
  leaseUntil?: number;
  retryAt?: number;
  error?: string;
  result?: {
    videoId: string;
    title: string | null;
    author: string | null;
    durationSeconds: number | null;
    transcript: string;
    transcriptSource: string;
    transcriptChars: number;
    topics: string[];
    assessment: Awaited<ReturnType<typeof assessVideo>>;
    warning: string | null;
  };
}
export class VideoQueueError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function enqueueVideo(owner: string, url: string) {
  const video = videoId(url);
  if (!video)
    throw new VideoQueueError("Provide a valid public YouTube lecture URL.");
  const id =
    "video-" +
    createHash("sha256")
      .update(owner + ":" + video)
      .digest("hex");
  const existing = await ownedVideo(id, owner);
  if (
    existing?.status === "done" &&
    Date.now() - Date.parse(existing.updatedAt) < 86400000
  )
    return existing;
  if (
    !existing ||
    !["queued", "reading", "assessing"].includes(existing.status)
  ) {
    const count = useMongo()
      ? await (
          await collection("workspace_records")
        ).countDocuments({
          kind: "video-ingestion",
          owner,
          "payload.status": { $in: ["queued", "reading", "assessing"] },
        })
      : Number(
          db()
            .prepare(
              "SELECT COUNT(*) AS n FROM workspace_records WHERE kind='video-ingestion' AND owner=? AND json_extract(payload,'$.status') IN ('queued','reading','assessing')",
            )
            .get(owner)?.n || 0,
        );
    if (count >= 2)
      throw new VideoQueueError(
        "Two lectures are already processing. Resume those jobs before adding another.",
        429,
      );
  }
  return mutateRecord<VideoJob>(id, (old) => {
    if (
      old &&
      Date.now() - Date.parse(old.updatedAt) < 7 * 86400000 &&
      (["queued", "reading", "assessing"].includes(old.status) ||
        (old.status === "done" &&
          Date.now() - Date.parse(old.updatedAt) < 86400000))
    )
      return old;
    const now = new Date().toISOString();
    return {
      id,
      owner,
      kind: "video-ingestion",
      url: `https://www.youtube.com/watch?v=${video}`,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    };
  });
}
export async function ownedVideo(id: string, owner: string) {
  if (!/^video-[a-f0-9]{64}$/.test(id)) return null;
  const job = await record<VideoJob>(id);
  return job?.kind === "video-ingestion" &&
    job.owner === owner &&
    Date.now() - Date.parse(job.updatedAt) < 7 * 86400000
    ? job
    : null;
}
export function videoProjection(job: VideoJob) {
  return {
    id: job.id,
    status: job.status,
    updatedAt: job.updatedAt,
    attempts: job.attempts,
    error: job.error,
    canUpload: job.status === "needs_input",
    ...(job.status === "done" ? { result: job.result } : {}),
  };
}
export async function claimVideo(id: string, now = Date.now()) {
  const lease = randomUUID();
  const job = await mutateRecord<VideoJob>(id, (old) => {
    if (!old) throw new Error("Video job unavailable.");
    if (
      !["queued", "reading", "assessing"].includes(old.status) ||
      (old.leaseUntil || 0) > now ||
      (old.retryAt || 0) > now
    )
      return old;
    if (old.attempts >= 3)
      return {
        ...old,
        status: "error",
        lease: undefined,
        leaseUntil: undefined,
        error:
          "Video processing could not finish. Retry or upload your source.",
      };
    return {
      ...old,
      status: "reading",
      attempts: old.attempts + 1,
      lease,
      leaseUntil: now + 6 * 60_000,
      updatedAt: new Date(now).toISOString(),
    };
  });
  return job.lease === lease ? job : null;
}
export async function listOwnedVideos(owner: string) {
  return (await records<VideoJob>("video-ingestion", owner))
    .filter((job) => Date.now() - Date.parse(job.updatedAt) < 86400000)
    .slice(0, 10)
    .map((job) => ({
      ...videoProjection(job),
      result: undefined,
      title: job.result?.title || "YouTube lecture",
      url: job.url,
    }));
}
export async function cancelVideo(id: string, owner: string) {
  if (!(await ownedVideo(id, owner))) return null;
  return mutateRecord<VideoJob>(id, (old) => {
    if (!old || old.owner !== owner || old.kind !== "video-ingestion")
      throw new VideoQueueError("Video job not found.", 404);
    if (!["queued", "reading", "assessing"].includes(old.status)) return old;
    return {
      ...old,
      status: "cancelled",
      lease: undefined,
      leaseUntil: undefined,
      updatedAt: new Date().toISOString(),
      error: "Stopped by you. Prepare this lecture again to restart.",
    };
  });
}
async function updateLease(job: VideoJob, patch: Partial<VideoJob>) {
  return mutateRecord<VideoJob>(job.id, (old) => {
    if (!old) throw new Error("Video job unavailable.");
    if (old.lease !== job.lease) return old;
    return { ...old, ...patch, updatedAt: new Date().toISOString() };
  });
}
export async function processVideo(
  id: string,
  dependencies = { fetchYouTube, assessVideo, assertAccountActive },
) {
  const job = await claimVideo(id);
  if (!job) return;
  try {
    await dependencies.assertAccountActive(job.owner);
    let source: Awaited<ReturnType<typeof fetchYouTube>>;
    try {
      source = await dependencies.fetchYouTube(job.url);
    } catch (error) {
      if (
        (error as { retryable?: boolean })?.retryable ||
        (error instanceof Error &&
          ["TimeoutError", "AbortError"].includes(error.name))
      )
        throw error;
      await updateLease(job, {
        status: "needs_input",
        lease: undefined,
        leaseUntil: undefined,
        error:
          "Captions or reliable video reading were unavailable. Upload a recording you can use, or paste a transcript. We have not invented lecture content.",
      });
      return;
    }
    const active = await updateLease(job, { status: "assessing" });
    if (active.lease !== job.lease) return;
    const assessment = await dependencies.assessVideo(
      source.title || "",
      source.transcript,
    );
    if (["non_educational", "uncertain"].includes(assessment.classification)) {
      await updateLease(job, {
        status: "needs_input",
        lease: undefined,
        leaseUntil: undefined,
        error:
          "We could not identify enough reliable teaching content. Choose another lecture or supply clearer source material.",
      });
      return;
    }
    await updateLease(job, {
      status: "done",
      lease: undefined,
      leaseUntil: undefined,
      error: undefined,
      result: {
        videoId: source.videoId,
        title: source.title,
        author: source.author,
        durationSeconds: source.durationSeconds,
        transcript: source.transcript.slice(0, 100000),
        transcriptSource: source.transcriptSource,
        transcriptChars: source.transcriptChars,
        topics: assessment.topics,
        assessment,
        warning:
          source.transcriptSource === "video-digest"
            ? "Captions were unavailable. This is an AI-extracted video digest, not a verbatim transcript. Review it before generating."
            : assessment.classification === "mixed"
              ? "This video mixes teaching and other content. Review the source before generating."
              : null,
      },
    });
  } catch {
    await updateLease(job, {
      status: job.attempts >= 3 ? "error" : "queued",
      lease: undefined,
      leaseUntil: undefined,
      retryAt: Date.now() + job.attempts * 30_000,
      error:
        job.attempts >= 3
          ? "Video checking could not finish after three attempts. Prepare again later or upload your source; no lesson credits were used."
          : "Video checking is temporarily unavailable. Retrying safely; no lesson credits were used.",
    });
  }
}
export async function processPendingVideo() {
  const now = Date.now();
  let ids: string[];
  if (useMongo()) {
    ids = (
      await (
        await collection("workspace_records")
      )
        .find({
          kind: "video-ingestion",
          "payload.status": { $in: ["queued", "reading", "assessing"] },
          $and: [
            {
              $or: [
                { "payload.leaseUntil": { $exists: false } },
                { "payload.leaseUntil": { $lte: now } },
              ],
            },
            {
              $or: [
                { "payload.retryAt": { $exists: false } },
                { "payload.retryAt": { $lte: now } },
              ],
            },
          ],
        })
        .sort({ updatedAt: 1 })
        .limit(1)
        .toArray()
    ).map((row) => String(row._id));
  } else {
    ids = db()
      .prepare(
        `SELECT id FROM workspace_records WHERE kind='video-ingestion'
      AND json_extract(payload,'$.status') IN ('queued','reading','assessing')
      AND COALESCE(json_extract(payload,'$.leaseUntil'),0)<=?
      AND COALESCE(json_extract(payload,'$.retryAt'),0)<=? ORDER BY updated_at LIMIT 1`,
      )
      .all(now, now)
      .map((row) => String(row.id));
  }
  for (const id of ids) await processVideo(id);
}
