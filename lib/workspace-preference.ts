import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";

export type WorkspaceKind = "student" | "writer";
export const workspaceKind = (value: unknown): WorkspaceKind | null =>
  value === "student" || value === "writer" ? value : null;

// Workspace selection changes the starting screen, never authorization scopes.
export async function setWorkspace(user: string, workspace: WorkspaceKind) {
  if (useMongo())
    await (
      await collection("users")
    ).updateOne({ _id: user }, { $set: { workspace } });
  else
    db()
      .prepare("UPDATE users SET workspace=? WHERE id=?")
      .run(workspace, user);
}
