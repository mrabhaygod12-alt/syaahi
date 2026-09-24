import { MongoClient, type ClientSession, type Db } from "mongodb";
const state = globalThis as unknown as {
  mongoClient?: Promise<MongoClient>;
  mongoReady?: Promise<void>;
};
export const useMongo = () =>
  process.env.DATA_BACKEND === "mongo" || !!process.env.MONGODB_URI;
export async function mongo() {
  if (!process.env.MONGODB_URI)
    throw new Error("MongoDB Atlas is not configured.");
  if (!state.mongoClient)
    state.mongoClient = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
      maxIdleTimeMS: 60000,
    })
      .connect()
      .catch((e) => {
        state.mongoClient = undefined;
        throw e;
      });
  const client = await state.mongoClient;
  const database = client.db(process.env.MONGODB_DATABASE || "syaahi");
  if (!state.mongoReady)
    state.mongoReady = indexes(database).catch((e) => {
      console.warn("MongoDB index creation warning:", e instanceof Error ? e.message : e);
    });
  await state.mongoReady;
  return { client, database };
}
async function indexes(d: Db) {
  await Promise.all([
    d.collection("support_index").createIndex({user:1,createdAt:-1}),
    d.collection("referral_codes").createIndex({ code: 1 }, { unique: true }),
    d.collection("referrals").createIndex({ inviter: 1, rewardedAt: 1 }),
    d.collection("users").createIndex({ email: 1 }, { unique: true }),
    d
      .collection("sessions")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    d.collection("jobs").createIndex({ user: 1, createdAt: -1 }),
    d.collection("jobs").createIndex({ status: 1, leaseUntil: 1 }),
    d
      .collection("orders")
      .createIndex(
        { paymentId: 1 },
        {
          unique: true,
          partialFilterExpression: { paymentId: { $type: "string" } },
        },
      ),
    d
      .collection("limits")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    d.collection("referrals").createIndex({ referred: 1 }, { unique: true }),
  ]);
}
export async function collection(name: string) {
  return (await mongo()).database.collection<any>(name);
}
export async function mongoTransaction<T>(
  work: (d: Db, session: ClientSession) => Promise<T>,
): Promise<T> {
  const { client, database } = await mongo();
  const session = client.startSession();
  try {
    return (await session.withTransaction(() => work(database, session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      maxCommitTimeMS: 10000,
    })) as T;
  } finally {
    await session.endSession();
  }
}
