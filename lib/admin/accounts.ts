import { randomUUID } from "node:crypto";
import { db, transaction } from "@/lib/db";
import { collection, mongoTransaction, useMongo } from "@/lib/storage/mongo";
import { readState } from "@/lib/study/state";
import {
  DEFAULT_CONTROL,
  type AccountControl,
  type AdminRole,
} from "@/lib/auth/session-security";
import { adminEligibility } from "@/lib/auth/admin";
import type { Account } from "@/lib/auth/server";
import { auditSetup, type AdminEvent } from "./audit";
export class AdminInputError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const ROLES: AdminRole[] = [
  "none",
  "admin",
  "editor",
  "support",
  "billing",
];
export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  workspace: "student" | "writer";
  verified: boolean;
  control: AccountControl;
}
const literal = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export async function managedUsers(
  q = "",
  status = "all",
): Promise<ManagedUser[]> {
  if (
    q.length > 120 ||
    !["all", "active", "suspended", "deleted"].includes(status)
  )
    throw new AdminInputError("Invalid user filter.");
  let rows: any[];
  if (useMongo())
    rows = await (
      await collection("users")
    )
      .aggregate([
        {
          $match: q
            ? {
                $or: ["email", "name", "_id"].map((k) => ({
                  [k]: { $regex: literal(q), $options: "i" },
                })),
              }
            : {},
        },
        {
          $lookup: {
            from: "study_state",
            let: { key: { $concat: ["$_id", ":account-control"] } },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$key"] } } },
              { $project: { payload: 1 } },
            ],
            as: "access",
          },
        },
        {
          $set: {
            control: {
              $ifNull: [
                { $arrayElemAt: ["$access.payload", 0] },
                DEFAULT_CONTROL,
              ],
            },
          },
        },
        ...(status === "all" ? [] : [{ $match: { "control.status": status } }]),
        { $sort: { createdAt: -1, _id: 1 } },
        { $limit: 100 },
        {
          $lookup: {
            from: "verified_accounts",
            localField: "_id",
            foreignField: "_id",
            as: "verification",
          },
        },
        {
          $project: {
            _id: 1,
            email: 1,
            name: 1,
            createdAt: 1,
            workspace: 1,
            control: 1,
            verified: {
              $or: [
                { $eq: ["$verified", true] },
                { $gt: [{ $size: "$verification" }, 0] },
                { $gt: ["$verifiedAt", null] },
              ],
            },
          },
        },
      ])
      .toArray();
  else {
    await readState("@admin", "setup", null);
    const term = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
    rows = db()
      .prepare(
        "SELECT u.id,u.email,u.name,u.created_at,u.workspace,a.payload, EXISTS(SELECT 1 FROM verified_accounts v WHERE v.user_id=u.id) AS verified FROM users u LEFT JOIN study_state a ON a.id=u.id||':account-control' WHERE (u.email LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\' OR u.id LIKE ? ESCAPE '\\') AND (?='all' OR COALESCE(json_extract(a.payload,'$.status'),'active')=?) ORDER BY u.created_at DESC,u.id LIMIT 100",
      )
      .all(term, term, term, status, status)
      .map((r) => ({
        _id: r.id,
        ...r,
        createdAt: r.created_at,
        control: r.payload ? JSON.parse(String(r.payload)) : DEFAULT_CONTROL,
      }));
  }
  return rows.map((r) => ({
    id: String(r._id),
    email: String(r.email),
    name: String(r.name),
    createdAt: String(r.createdAt),
    workspace: r.workspace === "writer" ? "writer" : "student",
    verified: !!r.verified,
    control: { ...DEFAULT_CONTROL, ...r.control },
  }));
}
export async function supportAgents() {
  const ids = (process.env.SUPPORT_ADMIN_IDS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const emails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (useMongo())
    return (
      await (
        await collection("users")
      )
        .aggregate([
          {
            $lookup: {
              from: "study_state",
              let: { key: { $concat: ["$_id", ":account-control"] } },
              pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$key"] } } }],
              as: "access",
            },
          },
          {
            $set: {
              c: {
                $ifNull: [
                  { $arrayElemAt: ["$access.payload", 0] },
                  DEFAULT_CONTROL,
                ],
              },
            },
          },
          {
            $match: {
              "c.status": "active",
              $or: [
                { "c.role": { $in: ["admin", "support"] } },
                {
                  "c.role": null,
                  $or: [{ _id: { $in: ids } }, { email: { $in: emails } }],
                },
              ],
            },
          },
          { $sort: { name: 1, _id: 1 } },
          { $limit: 100 },
          { $project: { _id: 1, name: 1 } },
        ])
        .toArray()
    ).map((r) => ({ id: String(r._id), name: String(r.name) }));
  await readState("@admin", "setup", null);
  const clause = (values: string[]) =>
    values.length ? values.map(() => "?").join(",") : "NULL";
  return db()
    .prepare(
      `SELECT u.id,u.name FROM users u LEFT JOIN study_state a ON a.id=u.id||':account-control' WHERE COALESCE(json_extract(a.payload,'$.status'),'active')='active' AND (json_extract(a.payload,'$.role') IN ('admin','support') OR (json_extract(a.payload,'$.role') IS NULL AND (u.id IN (${clause(ids)}) OR lower(u.email) IN (${clause(emails)})))) ORDER BY u.name,u.id LIMIT 100`,
    )
    .all(...ids, ...emails)
    .map((r) => ({ id: String(r.id), name: String(r.name) }));
}
export async function changeManagedUser(actor: Account, input: any) {
  if (
    !adminEligibility(actor).users ||
    (!actor.adminAuthenticated &&
      (process.env.NODE_ENV === "production" ||
        process.env.ADMIN_MFA_ENFORCE === "1" ||
        actor.adminMfaEnrolled))
  )
    throw new AdminInputError(
      "Verified user-administrator access required.",
      403,
    );
  if (
    !input ||
    typeof input.id !== "string" ||
    input.id.length > 80 ||
    !Number.isInteger(input.version) ||
    input.version < 0 ||
    typeof input.reason !== "string" ||
    input.reason.trim().length < 5 ||
    input.reason.length > 500 ||
    !["edit", "access", "role"].includes(input.action)
  )
    throw new AdminInputError(
      "Include a valid user, current version, action and reason (5–500 characters).",
    );
  if (
    (input.action === "access" &&
      !["active", "suspended", "deleted"].includes(input.status)) ||
    (input.action === "role" && !ROLES.includes(input.role))
  )
    throw new AdminInputError("Invalid account status or role.");
  if (
    input.action === "edit" &&
    (typeof input.name !== "string" ||
      input.name.trim().length < 2 ||
      input.name.trim().length > 80)
  )
    throw new AdminInputError("Use a name of 2–80 characters.");
  if (input.id === actor.id && input.action !== "edit")
    throw new AdminInputError(
      "Another verified administrator must change your own role or access.",
    );
  const event: AdminEvent = {
    id: randomUUID(),
    actor: actor.id,
    target: input.id,
    action: "account." + input.action,
    at: new Date().toISOString(),
    detail: input.reason.trim(),
  };
  const compute = (old: AccountControl) => {
    if (old.version !== input.version)
      throw new AdminInputError(
        "This account changed. Reload before applying another change.",
        409,
      );
    return {
      ...old,
      ...(input.action === "role"
        ? { role: input.role }
        : input.action === "access"
          ? { status: input.status }
          : {}),
      version: old.version + 1,
      updatedAt: event.at,
      reason: event.detail,
    };
  };
  const emailRoots = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (useMongo())
    return mongoTransaction(async (d, session) => {
      await d
        .collection<any>("admin_guard")
        .updateOne(
          { _id: "roles" },
          { $inc: { revision: 1 } },
          { upsert: true, session },
        );
      const users = d.collection<any>("users"),
        state = d.collection<any>("study_state"),
        u = await users.findOne({ _id: input.id }, { session });
      if (!u) throw new AdminInputError("User not found.", 404);
      const id = input.id + ":account-control",
        old =
          (await state.findOne({ _id: id }, { session }))?.payload ||
          DEFAULT_CONTROL,
        next = compute(old);
      const wasRoot =
        old.status === "active" &&
        (old.role === "admin" ||
          (old.role === null && emailRoots.includes(u.email.toLowerCase())));
      const remainsRoot =
        next.status === "active" &&
        (next.role === "admin" ||
          (next.role === null && emailRoots.includes(u.email.toLowerCase())));
      if (wasRoot && !remainsRoot) {
        const roots = await users
          .aggregate(
            [
              {
                $lookup: {
                  from: "study_state",
                  let: { key: { $concat: ["$_id", ":account-control"] } },
                  pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$key"] } } }],
                  as: "access",
                },
              },
              {
                $set: {
                  c: {
                    $ifNull: [
                      { $arrayElemAt: ["$access.payload", 0] },
                      DEFAULT_CONTROL,
                    ],
                  },
                },
              },
              {
                $match: {
                  "c.status": "active",
                  $or: [
                    { "c.role": "admin" },
                    { "c.role": null, email: { $in: emailRoots } },
                  ],
                },
              },
              { $count: "n" },
            ],
            { session },
          )
          .toArray();
        if (Number(roots[0]?.n || 0) <= 1)
          throw new AdminInputError(
            "Keep at least one active user administrator.",
          );
      }
      await state.updateOne(
        { _id: id },
        { $set: { owner: input.id, payload: next } },
        { upsert: true, session },
      );
      if (input.action === "edit")
        await users.updateOne(
          { _id: input.id },
          { $set: { name: input.name.trim() } },
          { session },
        );
      else
        await d
          .collection("sessions")
          .deleteMany({ user: input.id }, { session });
      await d
        .collection<any>("admin_audit")
        .insertOne(
          {
            _id: event.id,
            ...event,
            expiresAt: new Date(Date.now() + 180 * 86400000),
          },
          { session },
        );
      return next;
    });
  await readState("@admin", "setup", null);
  auditSetup();
  return transaction(() => {
    const u = db()
      .prepare("SELECT id,email FROM users WHERE id=?")
      .get(input.id);
    if (!u) throw new AdminInputError("User not found.", 404);
    const key = input.id + ":account-control",
      row = db().prepare("SELECT payload FROM study_state WHERE id=?").get(key),
      old = row ? JSON.parse(String(row.payload)) : DEFAULT_CONTROL,
      next = compute(old);
    if (
      old.status === "active" &&
      (old.role === "admin" ||
        (old.role === null &&
          emailRoots.includes(String(u.email).toLowerCase()))) &&
      !(
        next.status === "active" &&
        (next.role === "admin" ||
          (next.role === null &&
            emailRoots.includes(String(u.email).toLowerCase())))
      )
    ) {
      const roots = db()
        .prepare(
          "SELECT u.email,a.payload FROM users u LEFT JOIN study_state a ON a.id=u.id||':account-control'",
        )
        .all()
        .filter((r) => {
          const c = r.payload ? JSON.parse(String(r.payload)) : DEFAULT_CONTROL;
          return (
            c.status === "active" &&
            (c.role === "admin" ||
              (c.role === null &&
                emailRoots.includes(String(r.email).toLowerCase())))
          );
        });
      if (roots.length <= 1)
        throw new AdminInputError(
          "Keep at least one active user administrator.",
        );
    }
    db()
      .prepare(
        "INSERT INTO study_state VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(key, input.id, JSON.stringify(next));
    if (input.action === "edit")
      db()
        .prepare("UPDATE users SET name=? WHERE id=?")
        .run(input.name.trim(), input.id);
    else db().prepare("DELETE FROM sessions WHERE user_id=?").run(input.id);
    db()
      .prepare("INSERT INTO admin_audit VALUES (?,?,?)")
      .run(event.id, event.at, JSON.stringify(event));
    return next;
  });
}
