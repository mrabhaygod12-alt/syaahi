import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { authError, currentUser } from "@/lib/auth/server";
import { getJob } from "@/lib/jobs/store";
import {
  accessRole,
  createShare,
  emptyCollaboration,
  getCollaboration,
  resolveShare,
} from "@/lib/study/collaboration";
import { mutateState, readState } from "@/lib/study/state";
import { rateLimit } from "@/lib/ratelimit";
async function handleGET(req: Request) {
  const denied = await authError(req);
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("lesson") || "";
  if (!id) {
    const user = (await currentUser(req))!.id;
    const ids = await readState<string[]>(user, "shared-lessons", []);
    const lessons = [];
    for (const key of ids.slice(-100)) {
      const lesson = await getJob(key);
      if (lesson && (await accessRole(lesson, user)))
        lessons.push({
          id: lesson.id,
          title: lesson.title || lesson.topics[0],
          sections: lesson.pages.length,
        });
    }
    return NextResponse.json(
      { lessons },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const job = await getJob(id);
  const role = job ? await accessRole(job, (await currentUser(req))!.id) : null;
  if (!job || !role)
    return NextResponse.json({ error: "Unknown lesson." }, { status: 404 });
  const state = await getCollaboration(id);
  return NextResponse.json(
    {
      role,
      comments: state.comments,
      members: state.members.map((m) => ({ name: m.name, role: m.role })),
      links: role === "owner" ? state.links.map(({ hash, ...l }) => l) : [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
async function handlePOST(req: Request) {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "collaboration", 30, 60000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "join") {
      const shared = await resolveShare(String(b.token || ""));
      if (!shared)
        throw new Error("This invitation has expired or was revoked.");
      const job = await getJob(shared.lesson);
      if (!job) throw new Error("This lesson is no longer available.");
      await mutateState("collaboration", job.id, emptyCollaboration(), (s) => {
        if (!s.links.some((l) => l.id === shared.link.id))
          throw new Error("Invitation revoked.");
        if (job.user === user.id) return s;
        if (
          s.members.length >= 50 &&
          !s.members.some((m) => m.user === user.id)
        )
          throw new Error("This lesson has reached its collaborator limit.");
        s.members = s.members.filter((m) => m.user !== user.id);
        s.members.push({
          user: user.id,
          name: user.name,
          role: shared.link.role,
          link: shared.link.id,
        });
        return s;
      });
      await mutateState<string[]>(user.id, "shared-lessons", [], (ids) =>
        Array.from(new Set([...ids, job.id])).slice(-100),
      );
      return NextResponse.json({ lesson: job.id });
    }
    const job = typeof b.lesson === "string" ? await getJob(b.lesson) : null;
    const role = job ? await accessRole(job, user.id) : null;
    if (!job || !role)
      return NextResponse.json({ error: "Unknown lesson." }, { status: 404 });
    if (b.action === "create") {
      if (role !== "owner")
        return NextResponse.json(
          { error: "Only the owner can create share links." },
          { status: 403 },
        );
      const result = await createShare(
        job,
        b.role === "editor" ? "editor" : "viewer",
      );
      return NextResponse.json({
        url: `/share/${result.token}`,
        id: result.id,
      });
    }
    await mutateState("collaboration", job.id, emptyCollaboration(), (s) => {
      if (b.action === "revoke") {
        if (role !== "owner")
          throw new Error("Only the owner can revoke access.");
        s.links = s.links.filter((l) => l.id !== b.link);
        s.members = s.members.filter((m) => m.link !== b.link);
      } else if (b.action === "comment") {
        const text = String(b.text || "").trim();
        const section = Number(b.section);
        if (
          !text ||
          text.length > 2000 ||
          !Number.isInteger(section) ||
          !job.pages[section]
        )
          throw new Error(
            "Choose a section and write a comment under 2,000 characters.",
          );
        s.comments.push({
          id: randomUUID(),
          user: user.id,
          name: user.name,
          text,
          section,
          at: new Date().toISOString(),
        });
        s.comments = s.comments.slice(-200);
      } else if (b.action === "delete-comment") {
        s.comments = s.comments.filter(
          (c) => c.id !== b.comment || (c.user !== user.id && role !== "owner"),
        );
      } else throw new Error("Unknown collaboration action.");
      return s;
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update sharing." },
      { status: 400 },
    );
  }
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
