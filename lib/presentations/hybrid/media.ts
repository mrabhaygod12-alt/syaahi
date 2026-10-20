import { randomUUID, createHash } from "node:crypto";
import { mkdir, stat, unlink } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GridFSBucket, ObjectId } from "mongodb";
import { chromium } from "playwright";
import { collection, mongo, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
import {
  mutateRecord,
  record,
  records,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
import { ownedDeck } from "../store";
import type { SlideManifest } from "./model";
import { checkedSlides } from "./export";
import { rendererLease, RendererBusy } from "./resources";
export interface MediaJob extends WorkspaceRecord {
  kind: "presentation-media";
  deck: string;
  revision: string;
  format: "mp4" | "vertical";
  status: "queued" | "working" | "done" | "error" | "cancelled";
  progress: number;
  slides: SlideManifest[];
  lease: string | null;
  leaseUntil: number;
  storageId?: string;
  bytes?: number;
  error?: string;
  createdAt: string;
  expires: number;
}
export function mediaConfiguration() {
  return {
    video:
      process.env.PRESENTATION_VIDEO_ENABLED === "true" &&
      process.env.PRESENTATION_REMOTION_LICENSE_ACK === "true",
    fps: 60,
    landscape: "3840 × 2160",
    vertical: "1080 × 1920",
    maxSeconds: Math.max(
      15,
      Math.min(600, Number(process.env.PRESENTATION_VIDEO_MAX_SECONDS) || 180),
    ),
  };
}
export function publicMediaJob(j: MediaJob) {
  return {
    id: j.id,
    format: j.format,
    status: j.status,
    progress: j.progress,
    error: j.error,
    createdAt: j.createdAt,
    expires: j.expires,
    bytes: j.bytes,
    revision: j.revision,
  };
}
export async function deckMedia(owner: string, id: string) {
  return (await records<MediaJob>("presentation-media", owner))
    .filter((j) => j.deck === id && j.expires > Date.now())
    .slice(0, 10)
    .map(publicMediaJob);
}
export async function queueMedia(
  owner: string,
  id: string,
  format: unknown,
  event: unknown,
) {
  if (format !== "mp4" && format !== "vertical")
    throw new Error("Choose landscape or vertical MP4.");
  if (typeof event !== "string" || !/^[a-f0-9-]{36}$/i.test(event))
    throw new Error("Use a valid request ID.");
  const config = mediaConfiguration();
  if (!config.video)
    throw new Error(
      "Video rendering needs an enabled rendering worker and confirmed Remotion license eligibility. PPTX, PDF and web exports remain available.",
    );
  const key = `presentation-media-${createHash("sha256")
      .update(owner + ":" + event)
      .digest("hex")}`,
    old = await record<MediaJob>(key);
  if (old) {
    if (old.owner !== owner || old.deck !== id || old.format !== format)
      throw new Error("Request ID already used.");
    return old;
  }
  const deck = await ownedDeck(owner, id);
  if (!deck) throw new Error("Presentation not found.");
  const slides = checkedSlides(deck).map((s) => ({
    ...s,
    notes: "",
    genome: { ...s.genome, logoId: undefined },
  }));
  if (slides.reduce((n, s) => n + s.duration, 0) > config.maxSeconds)
    throw new Error(
      `Shorten the scene durations to ${config.maxSeconds} seconds or less before exporting video.`,
    );
  const previous = await records<MediaJob>("presentation-media", owner);
  if (previous.some((j) => ["queued", "working"].includes(j.status)))
    throw new Error("Finish or cancel the pending video first.");
  if (
    previous.filter((j) => Date.parse(j.createdAt) > Date.now() - 86400000)
      .length >= 3
  )
    throw new Error(
      "Daily video export limit reached. Other export formats remain available.",
    );
  return mutateRecord<MediaJob>(
    key,
    (current) =>
      current || {
        id: key,
        owner,
        kind: "presentation-media",
        deck: id,
        revision: deck.updatedAt,
        format,
        status: "queued",
        progress: 0,
        slides,
        lease: null,
        leaseUntil: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expires: Date.now() + 86400000,
      },
  );
}
const directory = () =>
  join(
    process.env.DATA_DIR || join(process.cwd(), "data"),
    "presentation-media",
  );
async function storeFile(path: string, job: MediaJob) {
  const size = (await stat(path)).size;
  if (size > 250 * 1024 * 1024)
    throw new Error("Video exceeds the 250 MB delivery limit.");
  if (useMongo()) {
    const bucket = new GridFSBucket((await mongo()).database, {
        bucketName: "presentation_media",
      }),
      upload = bucket.openUploadStream(job.id + ".mp4", {
        metadata: { owner: job.owner, expires: new Date(job.expires) },
      });
    await pipeline(createReadStream(path), upload);
    return { storageId: upload.id.toHexString(), bytes: size };
  }
  await mkdir(directory(), { recursive: true });
  const storageId = randomUUID();
  await pipeline(
    createReadStream(path),
    createWriteStream(join(directory(), storageId + ".mp4"), { flags: "wx" }),
  );
  return { storageId, bytes: size };
}
async function discard(id: string) {
  if (useMongo()) {
    if (ObjectId.isValid(id))
      await new GridFSBucket((await mongo()).database, {
        bucketName: "presentation_media",
      })
        .delete(new ObjectId(id))
        .catch(() => {});
  } else if (/^[a-f0-9-]{36}$/i.test(id))
    await unlink(join(directory(), id + ".mp4")).catch(() => {});
}
export async function mediaDownload(owner: string, deck: string, id: string) {
  const job = await record<MediaJob>(id);
  if (
    !job ||
    job.owner !== owner ||
    job.deck !== deck ||
    job.kind !== "presentation-media" ||
    job.status !== "done" ||
    !job.storageId ||
    job.expires <= Date.now()
  )
    return null;
  if (
    useMongo()
      ? !/^[a-f0-9]{24}$/i.test(job.storageId)
      : !/^[a-f0-9-]{36}$/i.test(job.storageId)
  )
    return null;
  const stream = useMongo()
    ? new GridFSBucket((await mongo()).database, {
        bucketName: "presentation_media",
      }).openDownloadStream(new ObjectId(job.storageId))
    : createReadStream(join(directory(), job.storageId + ".mp4"));
  return { stream, job };
}
export async function cancelMedia(owner: string, deck: string, id: string) {
  return mutateRecord<MediaJob>(id, (old) => {
    if (
      !old ||
      old.owner !== owner ||
      old.deck !== deck ||
      old.kind !== "presentation-media" ||
      !["queued", "working"].includes(old.status)
    )
      throw new Error("Export is not pending.");
    return { ...old, status: "cancelled", updatedAt: new Date().toISOString() };
  });
}
let active = false,
  bundlePromise: Promise<string> | undefined;
let cleanedAt = 0;
/** Expired downloads and narration bytes are removed in bounded worker batches. */
export async function cleanExpiredMedia() {
  if (Date.now() - cleanedAt < 900000) return;
  cleanedAt = Date.now();
  const now = Date.now(),
    rows = useMongo()
      ? (
          await (
            await collection("workspace_records")
          )
            .find({
              kind: { $in: ["presentation-media", "presentation-narration"] },
              "payload.expires": { $lte: now },
            })
            .limit(10)
            .toArray()
        ).map((row) => row.payload)
      : db()
          .prepare(
            "SELECT payload FROM workspace_records WHERE kind IN ('presentation-media','presentation-narration') AND json_extract(payload,'$.expires')<=? LIMIT 10",
          )
          .all(now)
          .map((row) => JSON.parse(String(row.payload)));
  for (const row of rows) {
    if (row.kind === "presentation-media" && row.storageId)
      await discard(row.storageId);
    if (useMongo())
      await (
        await collection("workspace_records")
      ).deleteOne({
        _id: row.id,
        kind: row.kind,
        "payload.expires": { $lte: now },
      });
    else
      db()
        .prepare(
          "DELETE FROM workspace_records WHERE id=? AND json_extract(payload,'$.expires')<=?",
        )
        .run(row.id, now);
  }
}
export function kickMedia() {
  if (active || !mediaConfiguration().video) return;
  active = true;
  void pendingMedia()
    .catch(() => {})
    .finally(() => {
      active = false;
    });
}
export async function pendingMedia() {
  const now = Date.now();
  const raw = useMongo()
    ? (
        await (
          await collection("workspace_records")
        ).findOne(
          {
            kind: "presentation-media",
            "payload.status": { $in: ["queued", "working"] },
            "payload.leaseUntil": { $lte: now },
            "payload.expires": { $gt: now },
          },
          { sort: { updatedAt: 1 } },
        )
      )?.payload
    : db()
        .prepare(
          "SELECT payload FROM workspace_records WHERE kind='presentation-media' AND json_extract(payload,'$.status') IN ('queued','working') AND json_extract(payload,'$.leaseUntil')<=? AND json_extract(payload,'$.expires')>? ORDER BY updated_at ASC LIMIT 1",
        )
        .get(now, now)?.payload;
  const job: MediaJob | undefined =
    typeof raw === "string" ? JSON.parse(raw) : raw;
  if (job) await runMedia(job.id);
}
export async function runMedia(id: string) {
  if (!mediaConfiguration().video) return;
  let release: (() => Promise<void>) | undefined;
  try {
    release = await rendererLease();
  } catch (error) {
    if (error instanceof RendererBusy) return;
    throw error;
  }
  const lease = randomUUID(),
    path = join(tmpdir(), `syaahi-movie-${randomUUID()}.mp4`);
  let pulse: ReturnType<typeof setInterval> | undefined,
    deadline: ReturnType<typeof setTimeout> | undefined,
    stored: string | undefined;
  try {
    const job = await mutateRecord<MediaJob>(id, (old) => {
      if (
        !old ||
        !["queued", "working"].includes(old.status) ||
        old.leaseUntil > Date.now() ||
        old.expires < Date.now()
      )
        throw new Error("Export unavailable.");
      return {
        ...old,
        status: "working",
        lease,
        leaseUntil: Date.now() + 120000,
        updatedAt: new Date().toISOString(),
      };
    });
    const { bundle } = await import("@remotion/bundler"),
      { renderMedia, selectComposition, makeCancelSignal } =
        await import("@remotion/renderer");
    const { cancel, cancelSignal } = makeCancelSignal();
    deadline = setTimeout(cancel, 20 * 60000);
    pulse = setInterval(
      () =>
        void mutateRecord<MediaJob>(id, (old) => {
          if (!old || old.lease !== lease || old.status !== "working") {
            cancel();
            throw new Error("Lease ended.");
          }
          return { ...old, leaseUntil: Date.now() + 120000 };
        }).catch(() => cancel()),
      15000,
    );
    pulse.unref();
    if (!bundlePromise)
      bundlePromise = bundle({
        entryPoint: join(
          process.cwd(),
          "lib/presentations/hybrid/VideoRoot.tsx",
        ),
        publicDir: null,
        enableCaching: true,
      }).catch((e) => {
        bundlePromise = undefined;
        throw e;
      });
    const serveUrl = await bundlePromise,
      inputProps = { slides: job.slides, vertical: job.format === "vertical" },
      browserExecutable = chromium.executablePath();
    const composition = await selectComposition({
      serveUrl,
      id: "Syaahi",
      inputProps,
      browserExecutable,
    });
    let last = 0;
    await renderMedia({
      composition,
      serveUrl,
      inputProps,
      codec: "h264",
      outputLocation: path,
      browserExecutable,
      concurrency: 1,
      crf: 20,
      pixelFormat: "yuv420p",
      timeoutInMilliseconds: 60000,
      cancelSignal,
      onProgress: ({ progress }) => {
        if (Date.now() - last < 3000) return;
        last = Date.now();
        void mutateRecord<MediaJob>(id, (old) => {
          if (!old || old.lease !== lease || old.status !== "working") {
            cancel();
            throw new Error("Lease lost.");
          }
          return {
            ...old,
            progress: Math.min(99, Math.round(progress * 100)),
            updatedAt: new Date().toISOString(),
          };
        }).catch(() => cancel());
      },
    });
    const file = await storeFile(path, job);
    stored = file.storageId;
    await mutateRecord<MediaJob>(id, (old) => {
      if (!old || old.lease !== lease || old.status !== "working")
        throw new Error("Export cancelled.");
      return {
        ...old,
        ...file,
        status: "done",
        progress: 100,
        slides: [],
        lease: null,
        leaseUntil: 0,
        updatedAt: new Date().toISOString(),
      };
    });
    stored = undefined;
  } catch {
    await mutateRecord<MediaJob>(id, (old) => {
      if (!old || old.lease !== lease || old.status !== "working")
        throw new Error("Lease lost.");
      return {
        ...old,
        status: "error",
        slides: [],
        lease: null,
        leaseUntil: 0,
        error:
          "Video rendering stopped. Try a shorter deck or another export format. No generation credits were charged.",
        updatedAt: new Date().toISOString(),
      };
    }).catch(() => {});
  } finally {
    if (pulse) clearInterval(pulse);
    if (deadline) clearTimeout(deadline);
    if (stored) await discard(stored);
    await unlink(path).catch(() => {});
    await release();
  }
}
