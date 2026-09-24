import { randomUUID } from "node:crypto";
import { collection, mongoTransaction } from "./mongo";
import type { Job, JobPage } from "../jobs/store";
const clean = (doc: any): Job | null => {
  if (!doc) return null;
  const { _id, leaseUntil, leaseToken, ...job } = doc;
  return job as Job;
};
export async function mongoGetJob(id: string) {
  return clean(await (await collection("jobs")).findOne({ _id: id }));
}
export async function mongoCreateJob(job: Job) {
  await mongoTransaction(async (d, session) => {
    const opts = { session };
    const wallet = await d
      .collection<any>("wallets")
      .updateOne(
        { _id: job.user, balance: { $gte: job.total } },
        { $inc: { balance: -job.total } },
        opts,
      );
    if (!wallet.modifiedCount)
      throw new Error("Insufficient page balance for this outline.");
    await d
      .collection<any>("reservations")
      .insertOne({ _id: job.id, user: job.user, remaining: job.total }, opts);
    await d
      .collection<any>("ledger")
      .insertOne(
        {
          _id: `reserve:${job.id}`,
          user: job.user,
          delta: -job.total,
          reason: "Lesson reservation",
          createdAt: new Date(),
        },
        opts,
      );
    await d
      .collection<any>("jobs")
      .insertOne({ _id: job.id, ...job, leaseUntil: 0 }, opts);
  });
  return job;
}
export async function mongoRevise(id: string, fn: (j: Job) => Job) {
  return mongoTransaction(async (d, session) => {
    const c = d.collection<any>("jobs");
    const doc = await c.findOne({ _id: id }, { session });
    if (!doc) return null;
    const result = fn(clean(doc)!);
    await c.updateOne({ _id: id }, { $set: result }, { session });
    return result;
  });
}
export async function mongoList(user: string, limit: number) {
  return (
    await (
      await collection("jobs")
    )
      .find({ user })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  ).map((d) => clean(d)!);
}
export async function mongoDelete(id: string) {
  return !!(
    await (
      await collection("jobs")
    ).deleteOne({ _id: id, status: { $in: ["done", "error"] } })
  ).deletedCount;
}
export async function mongoClaim(id: string) {
  const token = randomUUID();
  const doc = await (
    await collection("jobs")
  ).findOneAndUpdate(
    {
      _id: id,
      $or: [
        { status: "queued" },
        { status: "working", leaseUntil: { $lt: Date.now() } },
      ],
    },
    {
      $set: {
        status: "working",
        leaseToken: token,
        leaseUntil: Date.now() + 120000,
      },
    },
    { returnDocument: "after" },
  );
  return doc ? { job: clean(doc)!, token } : null;
}
export async function mongoRenew(id: string, token: string) {
  await (
    await collection("jobs")
  ).updateOne(
    { _id: id, leaseToken: token },
    { $set: { leaseUntil: Date.now() + 120000 } },
  );
}
export async function mongoCommit(
  id: string,
  token: string,
  index: number,
  page: JobPage,
) {
  return mongoTransaction(async (d, session) => {
    const opts = { session };
    const c = d.collection<any>("jobs");
    const doc = await c.findOne({ _id: id, leaseToken: token }, opts);
    if (!doc) throw new Error("Worker lease lost.");
    if (doc.pages.length > index) return false;
    if (doc.pages.length !== index)
      throw new Error("Out-of-order page commit.");
    const r = await d
      .collection<any>("reservations")
      .updateOne(
        { _id: id, remaining: { $gt: 0 } },
        { $inc: { remaining: -1 } },
        opts,
      );
    if (!r.modifiedCount) throw new Error("No reserved page unit.");
    await c.updateOne(
      { _id: id, leaseToken: token },
      { $push: { pages: page }, $inc: { creditsSpent: 1 } } as any,
      opts,
    );
    return true;
  });
}
export async function mongoFinish(id: string, token: string, error?: string) {
  await mongoTransaction(async (d, session) => {
    const opts = { session };
    const c = d.collection<any>("jobs");
    const job = await c.findOne({ _id: id, leaseToken: token }, opts);
    if (!job) return;
    const r = await d
      .collection<any>("reservations")
      .findOne({ _id: id }, opts);
    if (r?.remaining) {
      await d
        .collection<any>("wallets")
        .updateOne({ _id: job.user }, { $inc: { balance: r.remaining } }, opts);
      await d
        .collection<any>("ledger")
        .insertOne(
          {
            _id: randomUUID(),
            user: job.user,
            delta: r.remaining,
            reason: "Unused reservation",
            createdAt: new Date(),
          },
          opts,
        );
    }
    await d.collection<any>("reservations").deleteOne({ _id: id }, opts);
    const done = job.pages.length === job.total;
    await c.updateOne(
      { _id: id, leaseToken: token },
      {
        $set: {
          status: done ? "done" : "error",
          error:
            error ||
            (done ? null : "Generation stopped; unused balance returned."),
          finishedAt: new Date().toISOString(),
          leaseUntil: 0,
        },
        $unset: { leaseToken: "" },
      },
      opts,
    );
  });
}
export async function mongoResume(id: string) {
  return mongoTransaction(async (d, session) => {
    const opts = { session };
    const c = d.collection<any>("jobs");
    const job = await c.findOne({ _id: id, status: "error" }, opts);
    if (!job) return false;
    const count = job.total - job.pages.length;
    if (count <= 0) return false;
    const wallet = await d
      .collection<any>("wallets")
      .updateOne(
        { _id: job.user, balance: { $gte: count } },
        { $inc: { balance: -count } },
        opts,
      );
    if (!wallet.modifiedCount)
      throw new Error("Insufficient balance to resume.");
    await d
      .collection<any>("reservations")
      .insertOne({ _id: id, user: job.user, remaining: count }, opts);
    await d
      .collection<any>("ledger")
      .insertOne(
        {
          _id: randomUUID(),
          user: job.user,
          delta: -count,
          reason: "Resume reservation",
          createdAt: new Date(),
        },
        opts,
      );
    await c.updateOne(
      { _id: id },
      { $set: { status: "queued", error: null, finishedAt: null } },
      opts,
    );
    return true;
  });
}
export async function mongoPending() {
  return (
    await (
      await collection("jobs")
    )
      .find({
        $or: [
          { status: "queued" },
          { status: "working", leaseUntil: { $lt: Date.now() } },
        ],
      })
      .sort({ createdAt: 1 })
      .limit(8)
      .project({ _id: 1 })
      .toArray()
  ).map((d) => String(d._id));
}
