import { useMongo, collection } from "@/lib/storage/mongo";
import * as cloud from "@/lib/storage/mongo-jobs";
import { randomUUID } from "node:crypto";
import { db, transaction } from "@/lib/db";

export interface JobPage {
  topic: string;
  markdown: string;
  provider: string;
  model: string;
}
export interface JobPractice {
  quiz: Array<{ q: string; type: string; options?: string[]; answer: string }>;
  flashcards: Array<{ front: string; back: string }>;
}
export type SourceKind = "topic" | "syllabus" | "youtube" | "upload";

export interface JobProgress {
  /** 0-based section indices the learner marked complete (Learn room). */
  completed: number[];
  lastRoom?: string;
}

export interface Job {
  revision?: number;
  id: string;
  user: string;
  topics: string[];
  style: "detailed" | "concise";
  /** Source excerpt the pages were grounded in (transcript/syllabus), capped at submit. */
  context: string | null;
  /** Original source link (YouTube URL) when the job came from a video. */
  sourceUrl: string | null;
  sourceKind: SourceKind | null;
  sourceName: string | null;
  /** AI-written lesson title (short). Falls back to first topic. */
  title: string | null;
  /** Auto-built practice set (quiz + flashcards), generated once at completion. */
  practice: JobPractice | null;
  /** Set when a job stops for lack of credits — powers the top-up card. */
  shortage: { have: number; need: number } | null;
  /** Student answers from the question manager, baked into every page prompt. */
  brief: string | null;
  /** Note language chosen before generation: english | hindi | hinglish. */
  language: string | null;
  status: "queued" | "working" | "done" | "error";
  pages: JobPage[];
  total: number;
  /** Planner's intended page count (persisted even if generation stops early). */
  plannedTotal: number;
  planNote: string | null;
  progress: JobProgress | null;
  pdfTemplate: "classic" | "poster" | "lab" | "magazine" | null;
  podcastScript: string | null;
  error: string | null;
  creditsSpent: number;
  createdAt: string;
  finishedAt: string | null;
}

function decode(payload: unknown): Job {
  return JSON.parse(String(payload));
}
export async function getJob(id: string): Promise<Job | null> {
  if (useMongo()) return cloud.mongoGetJob(id);
  const row = db().prepare("SELECT payload FROM jobs WHERE id=?").get(id);
  return row ? decode(row.payload) : null;
}
export async function createJob(
  user: string,
  topics: string[],
  style: "detailed" | "concise",
  extra?: {
    context?: string;
    brief?: string;
    sourceUrl?: string;
    sourceKind?: SourceKind;
    sourceName?: string;
    planNote?: string;
    language?: string;
  },
): Promise<Job> {
  const job: Job = {
    id: randomUUID(),
    user,
    topics,
    style,
    context: extra?.context?.slice(0, 100000) || null,
    brief: extra?.brief?.slice(0, 1000) || null,
    sourceUrl: extra?.sourceUrl?.slice(0, 500) || null,
    sourceKind: extra?.sourceKind || "topic",
    sourceName: extra?.sourceName?.slice(0, 160) || null,
    planNote: extra?.planNote || null,
    language: extra?.language || "english",
    title: null,
    practice: null,
    shortage: null,
    status: "queued",
    pages: [],
    total: topics.length,
    plannedTotal: topics.length,
    progress: { completed: [] },
    pdfTemplate: "classic",
    podcastScript: null,
    error: null,
    creditsSpent: 0,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };
  if (useMongo()) return cloud.mongoCreateJob(job);
  transaction(() => {
    const available = Number(
      db().prepare("SELECT balance FROM wallets WHERE user_id=?").get(user)
        ?.balance ?? 0,
    );
    if (available < topics.length)
      throw new Error(`Need ${topics.length} credits; available ${available}.`);
    if (!topics.length) throw new Error("No topics supplied.");
    db()
      .prepare("UPDATE wallets SET balance=balance-? WHERE user_id=?")
      .run(topics.length, user);
    db()
      .prepare("INSERT INTO reservations VALUES (?,?,?)")
      .run(job.id, user, topics.length);
    db()
      .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
      .run(
        `reserve:${job.id}`,
        user,
        -topics.length,
        "Reserved for lesson",
        job.createdAt,
      );
    db()
      .prepare("INSERT INTO jobs (id,user_id,status,payload) VALUES (?,?,?,?)")
      .run(job.id, user, job.status, JSON.stringify(job));
  });
  return job;
}
export async function updateJob(
  id: string,
  patch: Partial<Job>,
): Promise<Job | null> {
  if (useMongo())
    return cloud.mongoRevise(id, (old) => ({
      ...old,
      ...patch,
      id,
      revision: (old.revision || 0) + 1,
    }));
  return transaction(() => {
    const row = db().prepare("SELECT payload FROM jobs WHERE id=?").get(id);
    if (!row) return null;
    const old = decode(row.payload);
    const job = { ...old, ...patch, id, revision: (old.revision || 0) + 1 };
    db()
      .prepare("UPDATE jobs SET payload=?,status=? WHERE id=?")
      .run(JSON.stringify(job), job.status, id);
    return job;
  });
}
export async function listJobs(user: string, limit = 20): Promise<Job[]> {
  if (useMongo()) return cloud.mongoList(user, limit);
  return db()
    .prepare(
      "SELECT payload FROM jobs WHERE user_id=? ORDER BY rowid DESC LIMIT ?",
    )
    .all(user, limit)
    .map((r) => decode(r.payload));
}
export async function deleteJob(id: string): Promise<boolean> {
  if (useMongo()) return cloud.mongoDelete(id);
  return transaction(() => {
    const row = db().prepare("SELECT status FROM jobs WHERE id=?").get(id);
    if (!row || ["working", "queued"].includes(String(row.status)))
      return false;
    return !!db().prepare("DELETE FROM jobs WHERE id=?").run(id).changes;
  });
}
export async function clearFailed(user: string): Promise<number> {
  if (useMongo())
    return (
      await (await collection("jobs")).deleteMany({ user, status: "error" })
    ).deletedCount;
  return Number(
    db()
      .prepare("DELETE FROM jobs WHERE user_id=? AND status='error'")
      .run(user).changes,
  );
}
export async function claimJob(
  id: string,
): Promise<{ job: Job; token: string } | null> {
  if (useMongo()) return cloud.mongoClaim(id);
  return transaction(() => {
    const now = Date.now();
    const row = db()
      .prepare(
        "SELECT payload FROM jobs WHERE id=? AND (status='queued' OR (status='working' AND lease_until<?))",
      )
      .get(id, now);
    if (!row) return null;
    const job = decode(row.payload);
    job.status = "working";
    const token = randomUUID();
    db()
      .prepare(
        "UPDATE jobs SET status=?,payload=?,lease_until=?,lease_token=? WHERE id=?",
      )
      .run("working", JSON.stringify(job), now + 120000, token, id);
    return { job, token };
  });
}
export async function renewLease(id: string, token: string) {
  if (useMongo()) return cloud.mongoRenew(id, token);
  db()
    .prepare("UPDATE jobs SET lease_until=? WHERE id=? AND lease_token=?")
    .run(Date.now() + 120000, id, token);
}
export async function commitPage(
  id: string,
  token: string,
  index: number,
  page: JobPage,
): Promise<boolean> {
  if (useMongo()) return cloud.mongoCommit(id, token, index, page);
  return transaction(() => {
    const row = db()
      .prepare("SELECT payload FROM jobs WHERE id=? AND lease_token=?")
      .get(id, token);
    if (!row) throw new Error("Worker lease lost.");
    const job = decode(row.payload);
    if (job.pages.length > index) return false;
    if (job.pages.length !== index)
      throw new Error("Out-of-order page commit.");
    const res = db()
      .prepare(
        "UPDATE reservations SET remaining=remaining-1 WHERE job_id=? AND remaining>0",
      )
      .run(id);
    if (!res.changes) throw new Error("No reserved credit for page.");
    job.pages.push(page);
    job.creditsSpent++;
    db()
      .prepare("UPDATE jobs SET payload=? WHERE id=? AND lease_token=?")
      .run(JSON.stringify(job), id, token);
    return true;
  });
}
export async function finishJob(id: string, token: string, error?: string) {
  if (useMongo()) return cloud.mongoFinish(id, token, error);
  transaction(() => {
    const row = db()
      .prepare("SELECT payload FROM jobs WHERE id=? AND lease_token=?")
      .get(id, token);
    if (!row) return;
    const job = decode(row.payload);
    const reservation = db()
      .prepare("SELECT * FROM reservations WHERE job_id=?")
      .get(id);
    const refund = Number(reservation?.remaining ?? 0);
    if (refund) {
      db()
        .prepare("UPDATE wallets SET balance=balance+? WHERE user_id=?")
        .run(refund, job.user);
      db()
        .prepare("INSERT OR IGNORE INTO ledger VALUES (?,?,?,?,?)")
        .run(
          randomUUID(),
          job.user,
          refund,
          "Unused reservation",
          new Date().toISOString(),
        );
    }
    db().prepare("DELETE FROM reservations WHERE job_id=?").run(id);
    job.status = job.pages.length === job.total ? "done" : "error";
    job.error =
      error ||
      (job.status === "error"
        ? "Generation stopped. Unused credits returned."
        : null);
    job.finishedAt = new Date().toISOString();
    db()
      .prepare(
        "UPDATE jobs SET status=?,payload=?,lease_until=0,lease_token=NULL WHERE id=?",
      )
      .run(job.status, JSON.stringify(job), id);
  });
}
export async function resumeJob(id: string): Promise<boolean> {
  if (useMongo()) return cloud.mongoResume(id);
  return transaction(() => {
    const row = db()
      .prepare("SELECT payload FROM jobs WHERE id=? AND status='error'")
      .get(id);
    if (!row) return false;
    const job = decode(row.payload);
    const count = job.total - job.pages.length;
    if (count <= 0) return false;
    if (
      !db()
        .prepare(
          "UPDATE wallets SET balance=balance-? WHERE user_id=? AND balance>=?",
        )
        .run(count, job.user, count).changes
    )
      throw new Error("Insufficient credits to resume.");
    db()
      .prepare("INSERT INTO reservations VALUES (?,?,?)")
      .run(id, job.user, count);
    db()
      .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
      .run(
        randomUUID(),
        job.user,
        -count,
        "Resume reservation",
        new Date().toISOString(),
      );
    job.status = "queued";
    job.error = null;
    job.finishedAt = null;
    db()
      .prepare("UPDATE jobs SET status=?,payload=? WHERE id=?")
      .run("queued", JSON.stringify(job), id);
    return true;
  });
}
export async function pendingJobs(): Promise<string[]> {
  if (useMongo()) return cloud.mongoPending();
  return db()
    .prepare(
      "SELECT id FROM jobs WHERE status='queued' OR (status='working' AND lease_until<?) LIMIT 4",
    )
    .all(Date.now())
    .map((r) => String(r.id));
}
export async function reviseJob(
  id: string,
  revise: (job: Job) => Job,
): Promise<Job | null> {
  if (useMongo()) return cloud.mongoRevise(id, revise);
  return transaction(() => {
    const row = db().prepare("SELECT payload FROM jobs WHERE id=?").get(id);
    if (!row) return null;
    const job = revise(decode(row.payload));
    db()
      .prepare("UPDATE jobs SET payload=?,status=? WHERE id=?")
      .run(JSON.stringify(job), job.status, id);
    return job;
  });
}
