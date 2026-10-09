import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
import type { Story } from "./stories";
export interface StoryActivity {
  likes: number;
  comments: number;
  views: number;
}
/** Aggregate reviewed stories in a bounded batch; never expose reader identities. */
export async function storyActivities(
  stories: Story[],
): Promise<Map<string, StoryActivity>> {
  const visible = stories.filter((s) => s.status === "published").slice(0, 240);
  const ids = visible.map((s) => s.id);
  const result = new Map(
    visible.map((s) => [
      s.id,
      {
        likes: 0,
        comments: 0,
        views: Math.max(0, Number(s.analytics?.views) || 0),
      },
    ]),
  );
  if (!ids.length) return result;
  if (useMongo()) {
    const [likes, comments] = await Promise.all([
      (await collection("story_engagement"))
        .aggregate([
          { $match: { storyId: { $in: ids }, upvoted: true } },
          { $group: { _id: "$storyId", count: { $sum: 1 } } },
        ])
        .toArray(),
      (await collection("workspace_records"))
        .aggregate([
          {
            $match: {
              kind: "story-response",
              "payload.storyId": { $in: ids },
              "payload.hidden": false,
            },
          },
          { $group: { _id: "$payload.storyId", count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);
    for (const r of likes) result.get(r._id)!.likes = Number(r.count);
    for (const r of comments) result.get(r._id)!.comments = Number(r.count);
  } else {
    const marks = ids.map(() => "?").join(",");
    const likes = db()
      .prepare(
        `SELECT story_id id,COUNT(*) n FROM story_engagement WHERE story_id IN (${marks}) AND upvoted=1 GROUP BY story_id`,
      )
      .all(...ids);
    const comments = db()
      .prepare(
        `SELECT json_extract(payload,'$.storyId') id,COUNT(*) n FROM workspace_records WHERE kind='story-response' AND json_extract(payload,'$.hidden')=0 AND json_extract(payload,'$.storyId') IN (${marks}) GROUP BY json_extract(payload,'$.storyId')`,
      )
      .all(...ids);
    for (const r of likes) result.get(String(r.id))!.likes = Number(r.n);
    for (const r of comments) result.get(String(r.id))!.comments = Number(r.n);
  }
  return result;
}
