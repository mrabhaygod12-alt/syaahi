import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readState, mutateState } from "@/lib/study/state";
import type { Job } from "@/lib/jobs/store";
export interface Collaboration {
  links: Array<{
    id: string;
    hash: string;
    role: "viewer" | "editor";
    created: string;
  }>;
  members: Array<{
    user: string;
    name: string;
    role: "viewer" | "editor";
    link: string;
  }>;
  comments: Array<{
    id: string;
    user: string;
    name: string;
    text: string;
    section: number;
    at: string;
  }>;
}
export const emptyCollaboration = (): Collaboration => ({
  links: [],
  members: [],
  comments: [],
});
export const shareHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const getCollaboration = (id: string) =>
  readState("collaboration", id, emptyCollaboration());
export async function accessRole(
  job: Job,
  user: string,
): Promise<"owner" | "editor" | "viewer" | null> {
  if (job.user === user) return "owner";
  const state = await getCollaboration(job.id);
  return (
    state.members.find(
      (m) => m.user === user && state.links.some((l) => l.id === m.link),
    )?.role || null
  );
}
export async function createShare(job: Job, role: "viewer" | "editor") {
  const token = randomBytes(24).toString("hex"),
    hash = shareHash(token),
    id = randomUUID();
  await mutateState("collaboration", job.id, emptyCollaboration(), (s) => {
    if (s.links.length >= 20)
      throw new Error("Revoke an old link before creating more.");
    s.links.push({ id, hash, role, created: new Date().toISOString() });
    return s;
  });
  await mutateState("share-index", hash, { lesson: job.id, id }, () => ({
    lesson: job.id,
    id,
  }));
  return { token, id };
}
export async function resolveShare(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const hash = shareHash(token);
  const index = await readState<{ lesson: string; id: string } | null>(
    "share-index",
    hash,
    null,
  );
  if (!index) return null;
  const state = await getCollaboration(index.lesson);
  const link = state.links.find((l) => l.id === index.id && l.hash === hash);
  return link ? { lesson: index.lesson, link } : null;
}
