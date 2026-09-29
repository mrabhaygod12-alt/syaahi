import { db, transaction } from "@/lib/db";
import { collection, mongoTransaction, useMongo } from "@/lib/storage/mongo";
import { getPublicStory } from "./stories";

export interface GuideEngagement {
  upvotes: number;
  bookmarks: number;
  tippedCredits: number;
  viewer: {
    upvoted: boolean;
    bookmarked: boolean;
    tippedCredits: number;
  } | null;
}

type Row = {
  upvoted?: boolean | number;
  bookmarked?: boolean | number;
  tips?: number;
};
const key = (storyId: string, user: string) => `${storyId}:${user}`;

export async function guideEngagement(
  slug: string,
  user?: string,
): Promise<GuideEngagement> {
  const story = await getPublicStory(slug);
  if (!story) throw new Error("This guide is no longer available.");
  if (useMongo()) {
    const c = await collection("story_engagement");
    const [totals] = await c
      .aggregate([
        { $match: { storyId: story.id } },
        {
          $group: {
            _id: null,
            upvotes: { $sum: { $cond: ["$upvoted", 1, 0] } },
            bookmarks: { $sum: { $cond: ["$bookmarked", 1, 0] } },
            tippedCredits: { $sum: "$tips" },
          },
        },
      ])
      .toArray();
    const viewer = user
      ? ((await c.findOne({ _id: key(story.id, user) })) as Row | null)
      : null;
    return {
      upvotes: Number(totals?.upvotes || 0),
      bookmarks: Number(totals?.bookmarks || 0),
      tippedCredits: Number(totals?.tippedCredits || 0),
      viewer: user
        ? {
            upvoted: viewer?.upvoted === true,
            bookmarked: viewer?.bookmarked === true,
            tippedCredits: Number(viewer?.tips || 0),
          }
        : null,
    };
  }
  const totals = db()
    .prepare(
      "SELECT COALESCE(SUM(upvoted),0) upvotes, COALESCE(SUM(bookmarked),0) bookmarks, COALESCE(SUM(tips),0) tippedCredits FROM story_engagement WHERE story_id=?",
    )
    .get(story.id) as any;
  const viewer = user
    ? (db()
        .prepare(
          "SELECT upvoted,bookmarked,tips FROM story_engagement WHERE story_id=? AND user_id=?",
        )
        .get(story.id, user) as Row | undefined)
    : undefined;
  return {
    upvotes: Number(totals.upvotes),
    bookmarks: Number(totals.bookmarks),
    tippedCredits: Number(totals.tippedCredits),
    viewer: user
      ? {
          upvoted: Boolean(viewer?.upvoted),
          bookmarked: Boolean(viewer?.bookmarked),
          tippedCredits: Number(viewer?.tips || 0),
        }
      : null,
  };
}

export async function setGuideReaction(
  user: string,
  slug: string,
  action: "upvote" | "bookmark",
  value: boolean,
) {
  const story = await getPublicStory(slug);
  if (!story) throw new Error("This guide is no longer available.");
  const field = action === "upvote" ? "upvoted" : "bookmarked";
  const now = new Date().toISOString();
  if (useMongo()) {
    await (
      await collection("story_engagement")
    ).updateOne(
      { _id: key(story.id, user) },
      {
        $set: { [field]: value, updatedAt: now, storyId: story.id, user },
        $setOnInsert: {
          tips: 0,
          [field === "upvoted" ? "bookmarked" : "upvoted"]: false,
        },
      },
      { upsert: true },
    );
  } else
    transaction(() => {
      db()
        .prepare(
          "INSERT INTO story_engagement (story_id,user_id,upvoted,bookmarked,tips,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(story_id,user_id) DO UPDATE SET " +
            field +
            "=excluded." +
            field +
            ",updated_at=excluded.updated_at",
        )
        .run(
          story.id,
          user,
          action === "upvote" && value ? 1 : 0,
          action === "bookmark" && value ? 1 : 0,
          0,
          now,
        );
    });
  return guideEngagement(slug, user);
}

/** Transfer existing study credits only; it never charges money or creates credits. */
export async function tipGuideCreator(
  user: string,
  slug: string,
  credits: number,
  requestId: string,
) {
  if (!/^[a-f0-9-]{36}$/i.test(requestId || ""))
    throw new Error("A valid tip request identifier is required.");
  if (!Number.isSafeInteger(credits) || credits < 1 || credits > 20)
    throw new Error("Tip between 1 and 20 credits.");
  const story = await getPublicStory(slug);
  if (!story) throw new Error("This guide is no longer available.");
  if (story.user === user) throw new Error("You cannot tip your own guide.");
  const now = new Date();
  const event = `${user}:${requestId}`;
  const reason = `Tip for ${story.slug}`;
  if (useMongo()) {
    await mongoTransaction(async (d, session) => {
      const opts = { session },
        wallets = d.collection<any>("wallets"),
        ledger = d.collection<any>("ledger"),
        engagement = d.collection<any>("story_engagement");
      const previous = await ledger.findOne(
        { _id: `guide-tip:${event}:from` },
        opts,
      );
      if (previous) {
        if (previous.delta !== -credits || previous.reason !== reason)
          throw new Error("Tip request was already used for another transfer.");
        return;
      }
      const debited = await wallets.updateOne(
        { _id: user, balance: { $gte: credits } },
        { $inc: { balance: -credits } },
        opts,
      );
      if (!debited.modifiedCount)
        throw new Error("You do not have enough credits to send this tip.");
      const credited = await wallets.updateOne(
        { _id: story.user },
        { $inc: { balance: credits } },
        opts,
      );
      if (!credited.matchedCount)
        throw new Error("Creator wallet is unavailable.");
      await ledger.insertMany(
        [
          {
            _id: `guide-tip:${event}:from`,
            user,
            delta: -credits,
            reason: `Tip for ${story.slug}`,
            createdAt: now,
          },
          {
            _id: `guide-tip:${event}:to`,
            user: story.user,
            delta: credits,
            reason: `Tip from a reader for ${story.slug}`,
            createdAt: now,
          },
        ],
        opts,
      );
      await engagement.updateOne(
        { _id: key(story.id, user) },
        {
          $inc: { tips: credits },
          $set: { storyId: story.id, user, updatedAt: now.toISOString() },
          $setOnInsert: { upvoted: false, bookmarked: false },
        },
        { ...opts, upsert: true },
      );
    });
  } else
    transaction(() => {
      const previous = db()
        .prepare("SELECT delta,reason FROM ledger WHERE id=?")
        .get(`guide-tip:${event}:from`);
      if (previous) {
        if (previous.delta !== -credits || previous.reason !== reason)
          throw new Error("Tip request was already used for another transfer.");
        return;
      }
      const debited = db()
        .prepare(
          "UPDATE wallets SET balance=balance-? WHERE user_id=? AND balance>=?",
        )
        .run(credits, user, credits);
      if (!debited.changes)
        throw new Error("You do not have enough credits to send this tip.");
      const credited = db()
        .prepare("UPDATE wallets SET balance=balance+? WHERE user_id=?")
        .run(credits, story.user);
      if (!credited.changes) throw new Error("Creator wallet is unavailable.");
      db()
        .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
        .run(
          `guide-tip:${event}:from`,
          user,
          -credits,
          `Tip for ${story.slug}`,
          now.toISOString(),
        );
      db()
        .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
        .run(
          `guide-tip:${event}:to`,
          story.user,
          credits,
          `Tip from a reader for ${story.slug}`,
          now.toISOString(),
        );
      db()
        .prepare(
          "INSERT INTO story_engagement (story_id,user_id,upvoted,bookmarked,tips,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(story_id,user_id) DO UPDATE SET tips=tips+excluded.tips,updated_at=excluded.updated_at",
        )
        .run(story.id, user, 0, 0, credits, now.toISOString());
    });
  return guideEngagement(slug, user);
}
