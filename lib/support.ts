import { db, transaction } from "@/lib/db";
import { collection, mongoTransaction, useMongo } from "@/lib/storage/mongo";
import { randomUUID } from "node:crypto";
import { readState } from "@/lib/study/state";
import { auditSetup, type AdminEvent } from "@/lib/admin/audit";
import type { SupportTicket, TicketIndex } from "./support-types";
export { TICKET_STATUSES } from "./support-types";
export type { SupportTicket, TicketIndex, TicketStatus } from "./support-types";
export class TicketInputError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function publicTicket(t: SupportTicket) {
  return {
    id: t.id,
    user: t.user,
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    workspace: t.workspace || "student",
    revision: t.revision || 0,
    messages: t.messages,
  };
}
export function publicTicketIndex(t: TicketIndex) {
  const { priority, assignedTo, ...safe } = t;
  return safe;
}
function setup() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS support_index (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS support_user ON support_index(user_id,created_at)",
  );
}
export async function listTickets(
  user?: string,
  filters: { q?: string; status?: string; workspace?: string } = {},
): Promise<TicketIndex[]> {
  const q = filters.q?.trim().slice(0, 120) || "",
    status = filters.status || "all",
    workspace = filters.workspace || "all";
  const literal = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (useMongo())
    return (
      await (
        await collection("support_index")
      )
        .find({
          ...(user ? { user } : {}),
          ...(status !== "all" ? { status } : {}),
          ...(workspace !== "all"
            ? workspace === "student"
              ? {
                  $or: [
                    { workspace: "student" },
                    { workspace: { $exists: false } },
                  ],
                }
              : { workspace }
            : {}),
          ...(q
            ? {
                $and: [
                  {
                    $or: ["_id", "user", "subject", "category"].map((k) => ({
                      [k]: { $regex: literal, $options: "i" },
                    })),
                  },
                ],
              }
            : {}),
        })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray()
    ).map(({ _id, ...t }) => t as TicketIndex);
  setup();
  if (q || status !== "all" || workspace !== "all") {
    const term = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
    return db()
      .prepare(
        "SELECT payload FROM support_index WHERE (?='' OR user_id=?) AND (?='all' OR status=?) AND (?='all' OR COALESCE(json_extract(payload,'$.workspace'),'student')=?) AND (id LIKE ? ESCAPE '\\' OR user_id LIKE ? ESCAPE '\\' OR json_extract(payload,'$.subject') LIKE ? ESCAPE '\\' OR json_extract(payload,'$.category') LIKE ? ESCAPE '\\') ORDER BY created_at DESC,id LIMIT 100",
      )
      .all(
        user || "",
        user || "",
        status,
        status,
        workspace,
        workspace,
        term,
        term,
        term,
        term,
      )
      .map((r) => JSON.parse(String(r.payload)));
  }
  const rows = user
    ? db()
        .prepare(
          "SELECT payload FROM support_index WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
        )
        .all(user)
    : db()
        .prepare(
          "SELECT payload FROM support_index ORDER BY created_at DESC LIMIT 100",
        )
        .all();
  return rows.map((r) => JSON.parse(String(r.payload)));
}
export async function findTicket(id: string): Promise<TicketIndex | null> {
  if (useMongo()) {
    const row = await (await collection("support_index")).findOne({ _id: id });
    return row as TicketIndex | null;
  }
  setup();
  const row = db()
    .prepare("SELECT payload FROM support_index WHERE id=?")
    .get(id);
  return row ? JSON.parse(String(row.payload)) : null;
}
export async function saveTicketIndex(t: TicketIndex) {
  if (useMongo()) {
    await (
      await collection("support_index")
    ).updateOne({ _id: t.id }, { $set: t }, { upsert: true });
    return;
  }
  setup();
  db()
    .prepare(
      "INSERT INTO support_index VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload",
    )
    .run(t.id, t.user, t.status, t.createdAt, JSON.stringify(t));
}
export async function supportTicket(id: string) {
  const item = await findTicket(id);
  return item
    ? readState<SupportTicket | null>(item.user, `support:${id}`, null)
    : null;
}
/** Persist the conversation, queue entry and privileged audit in one transaction. */
export async function changeTicket(
  owner: string,
  id: string,
  change: (old: SupportTicket | null) => SupportTicket,
  actor?: string,
  action = "update",
  create = false,
) {
  const key = owner + ":support:" + id;
  const compute = (old: SupportTicket | null) => {
    const t = change(old);
    if (t.id !== id || t.user !== owner)
      throw new TicketInputError("Ticket identity cannot change.");
    return {
      ...t,
      revision: (old?.revision || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
  };
  const index = (t: SupportTicket): TicketIndex => ({
    id,
    user: owner,
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.createdAt,
    workspace: t.workspace || "student",
    priority: t.priority || "normal",
    assignedTo: t.assignedTo || null,
    updatedAt: t.updatedAt,
  });
  const event = (): AdminEvent => ({
    id: randomUUID(),
    actor: actor!,
    target: id,
    action: "support." + action,
    at: new Date().toISOString(),
    detail: "",
  });
  if (useMongo())
    return mongoTransaction(async (d, session) => {
      const state = d.collection<any>("study_state"),
        queue = d.collection<any>("support_index");
      if (create) {
        await d
          .collection<any>("support_guard")
          .updateOne(
            { _id: owner },
            { $inc: { revision: 1 } },
            { upsert: true, session },
          );
        const exists = await state.findOne({ _id: key }, { session });
        if (exists) {
          if (
            (exists.payload.workspace || "student") !== change(null).workspace
          )
            throw new TicketInputError(
              "Start a new request for this workspace.",
              409,
            );
          return exists.payload as SupportTicket;
        }
        const indexed = await queue.findOne({ _id: id }, { session });
        if (indexed && indexed.user !== owner)
          throw new TicketInputError(
            "Ticket request could not be accepted.",
            409,
          );
        if (
          (await queue.countDocuments(
            { user: owner, status: { $nin: ["resolved", "closed"] } },
            { session },
          )) >= 10
        )
          throw new TicketInputError(
            "You already have 10 active tickets. Reply to an existing ticket.",
            409,
          );
      }
      const old =
          (await state.findOne({ _id: key, owner }, { session }))?.payload ||
          null,
        t = compute(old);
      await state.updateOne(
        { _id: key },
        { $set: { owner, payload: t } },
        { upsert: true, session },
      );
      await queue.updateOne(
        { _id: id },
        { $set: index(t) },
        { upsert: true, session },
      );
      if (actor) {
        const e = event();
        await d.collection<any>("admin_audit").insertOne(
          {
            _id: e.id,
            ...e,
            expiresAt: new Date(Date.now() + 180 * 86400000),
          },
          { session },
        );
      }
      return t;
    });
  await readState(owner, "setup", null);
  setup();
  if (actor) auditSetup();
  return transaction(() => {
    const row = db()
        .prepare("SELECT payload FROM study_state WHERE id=? AND owner=?")
        .get(key, owner),
      old = row ? JSON.parse(String(row.payload)) : null;
    if (create && old) {
      if ((old.workspace || "student") !== change(null).workspace)
        throw new TicketInputError(
          "Start a new request for this workspace.",
          409,
        );
      return old as SupportTicket;
    }
    if (create) {
      const indexed = db()
        .prepare("SELECT user_id FROM support_index WHERE id=?")
        .get(id);
      if (indexed && indexed.user_id !== owner)
        throw new TicketInputError(
          "Ticket request could not be accepted.",
          409,
        );
    }
    if (
      create &&
      Number(
        db()
          .prepare(
            "SELECT count(*) AS n FROM support_index WHERE user_id=? AND status NOT IN ('resolved','closed')",
          )
          .get(owner)?.n || 0,
      ) >= 10
    )
      throw new TicketInputError(
        "You already have 10 active tickets. Reply to an existing ticket.",
        409,
      );
    const t = compute(old),
      i = index(t);
    db()
      .prepare(
        "INSERT INTO study_state VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(key, owner, JSON.stringify(t));
    db()
      .prepare(
        "INSERT INTO support_index VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload",
      )
      .run(id, owner, t.status, t.createdAt, JSON.stringify(i));
    if (actor) {
      const e = event();
      db()
        .prepare("INSERT INTO admin_audit VALUES (?,?,?)")
        .run(e.id, e.at, JSON.stringify(e));
    }
    return t;
  });
}
