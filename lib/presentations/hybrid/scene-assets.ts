import { randomUUID } from "node:crypto";
import {
  record,
  mutateRecord,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
export interface SceneAsset extends WorkspaceRecord {
  kind: "presentation-scene";
  name: string;
  bytes: string;
}
export async function ownedScene(owner: string, id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  const value = await record<SceneAsset>(id);
  return value?.kind === "presentation-scene" && value.owner === owner
    ? value
    : null;
}
export async function uploadScene(owner: string, name: string, bytes: Buffer) {
  if (
    !/\.splinecode$/i.test(name) ||
    bytes.length < 50 ||
    bytes.length > 4 * 1024 * 1024 ||
    /^\s*(?:<|MZ|#!|(?:export|import|function|const)\s)/.test(
      bytes.subarray(0, 80).toString("utf8"),
    )
  )
    throw new Error(
      "Choose a binary .splinecode export under 4 MB. Web pages and executable source are not accepted.",
    );
  const count = useMongo()
    ? await (
        await collection("workspace_records")
      ).countDocuments({ kind: "presentation-scene", owner })
    : Number(
        db()
          .prepare(
            "SELECT COUNT(*) AS n FROM workspace_records WHERE kind='presentation-scene' AND owner=?",
          )
          .get(owner)?.n || 0,
      );
  if (count >= 20) throw new Error("Scene library limit reached.");
  const id = randomUUID();
  await mutateRecord<SceneAsset>(id, () => ({
    id,
    owner,
    kind: "presentation-scene",
    name: name.slice(0, 120),
    bytes: bytes.toString("base64"),
    updatedAt: new Date().toISOString(),
  }));
  return { id, name: name.slice(0, 120) };
}
