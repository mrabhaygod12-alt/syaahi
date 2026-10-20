import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
/** Dashboard queries never load full source snapshots, history or narration blobs. */
export async function studioLibrary(owner: string) {
  if (useMongo()) {
    const c = await collection("workspace_records");
    const [decks, drafts] = await Promise.all([
      c
        .find(
          { kind: "presentation", owner },
          {
            projection: {
              "payload.id": 1,
              "payload.title": 1,
              "payload.status": 1,
              "payload.count": 1,
              "payload.updatedAt": 1,
              "payload.designEngine": 1,
              "payload.template": 1,
              "payload.slides": { $slice: 1 },
              "payload.quality": 1,
              "payload.stage": 1,
            },
          },
        )
        .sort({ updatedAt: -1 })
        .limit(80)
        .toArray(),
      c
        .find(
          { kind: "presentation-draft", owner },
          {
            projection: {
              "payload.id": 1,
              "payload.outline": { $slice: 1 },
              "payload.count": 1,
              "payload.updatedAt": 1,
              "payload.designEngine": 1,
              "payload.template": 1,
            },
          },
        )
        .sort({ updatedAt: -1 })
        .limit(80)
        .toArray(),
    ]);
    return {
      decks: decks.map((r) => r.payload),
      drafts: drafts.map((r) => r.payload),
    };
  }
  const rows = db().prepare(
    "SELECT id,kind,updated_at,json_extract(payload,'$.title') AS title,json_extract(payload,'$.status') AS status,json_extract(payload,'$.count') AS count,json_extract(payload,'$.designEngine') AS engine,json_extract(payload,'$.template') AS template,json_extract(payload,'$.slides[0]') AS preview,json_extract(payload,'$.quality') AS quality,json_extract(payload,'$.stage') AS stage,json_extract(payload,'$.outline[0]') AS heading FROM workspace_records WHERE kind=? AND owner=? ORDER BY updated_at DESC LIMIT 80",
  );
  const decks = rows
    .all("presentation", owner)
    .map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      count: r.count,
      updatedAt: r.updated_at,
      designEngine: r.engine || 1,
      template: r.template,
      slides: r.preview ? [JSON.parse(String(r.preview))] : [],
      quality: r.quality ? JSON.parse(String(r.quality)) : undefined,
      stage: r.stage,
    }));
  const drafts = rows
    .all("presentation-draft", owner)
    .map((r) => ({
      id: r.id,
      outline: [r.heading],
      count: r.count,
      updatedAt: r.updated_at,
      designEngine: r.engine || 1,
      template: r.template,
    }));
  return { decks, drafts };
}
