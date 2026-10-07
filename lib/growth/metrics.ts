import { createHash } from "node:crypto";
import { db, transaction } from "@/lib/db";
import { collection, mongoTransaction, useMongo } from "@/lib/storage/mongo";
import { mutateState, readState } from "@/lib/study/state";
export const PUBLIC_EVENTS = [
  "visit",
  "preview_start",
  "preview_ready",
  "signup_start",
  "template_download",
  "referral_share",
  "note_share",
] as const;
export type MetricEvent =
  | (typeof PUBLIC_EVENTS)[number]
  | "signup_created"
  | "note_ready"
  | "quiz_used"
  | "flashcard_used"
  | "paid";
interface Cohort {
  id: string;
  created: string;
  variant: "A" | "B";
  events: Array<{ id: string; name: MetricEvent; day: string }>;
  days: string[];
  account: boolean;
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const validVisitor = (s: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
export const visitorVariant = (s: string): "A" | "B" =>
  parseInt(hash(s)[0], 16) % 2 ? "B" : "A";
export async function forgetVisitor(visitor: string) {
  if (!validVisitor(visitor)) return;
  const id = hash("visitor:" + visitor);
  if (useMongo())
    await (await collection("growth_metrics")).deleteOne({ _id: id });
  else {
    setup();
    db().prepare("DELETE FROM growth_metrics WHERE id=?").run(id);
  }
}
function setup() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS growth_metrics (id TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at TEXT NOT NULL)",
  );
}
export async function setMeasurementConsent(owner: string, allowed: boolean) {
  await mutateState(owner, "growth-consent", false, () => allowed);
  if (!allowed) {
    const id = hash("account:" + owner);
    if (useMongo())
      await (await collection("growth_metrics")).deleteOne({ _id: id });
    else {
      setup();
      db().prepare("DELETE FROM growth_metrics WHERE id=?").run(id);
    }
  }
}
export async function recordMetric(
  visitor: string,
  name: MetricEvent,
  eventId: string,
  owner?: string,
  at = Date.now(),
) {
  if (!validVisitor(visitor) || !eventId || eventId.length > 160) return;
  if (owner && !(await readState(owner, "growth-consent", false))) return;
  const anonymousId = hash("visitor:" + visitor),
    id = owner ? hash("account:" + owner) : anonymousId;
  const day = new Date(at).toISOString().slice(0, 10);
  const merge = (old: Cohort | null, anonymous: Cohort | null): Cohort => {
    const base = old ||
      anonymous || {
        id,
        created: day,
        variant: visitorVariant(visitor),
        events: [],
        days: [],
        account: false,
      };
    const events = new Map(
      [...(anonymous?.events || []), ...base.events].map((e) => [e.id, e]),
    );
    const stable = hash(name + ":" + eventId);
    if (!events.has(stable)) events.set(stable, { id: stable, name, day });
    return {
      ...base,
      id,
      account: !!owner,
      events: [...events.values()]
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-500),
      days: [...new Set([...(anonymous?.days || []), ...base.days, day])]
        .sort()
        .slice(-90),
    };
  };
  const expires = new Date(at + 90 * 86400000);
  if (useMongo()) {
    await (
      await collection("growth_metrics")
    ).createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "growth_metrics_expiry" },
    );
    await mongoTransaction(async (d, session) => {
      if (
        owner &&
        !(await d
          .collection<any>("study_state")
          .findOneAndUpdate(
            { _id: owner + ":growth-consent", payload: true },
            { $inc: { metricRevision: 1 } },
            { session, returnDocument: "after" },
          ))
      )
        return;
      const c = d.collection<any>("growth_metrics");
      const old =
        (
          await c.findOne(
            { _id: id, expiresAt: { $gt: new Date(at) } },
            { session },
          )
        )?.payload || null;
      const anonymous = owner
        ? (
            await c.findOne(
              { _id: anonymousId, expiresAt: { $gt: new Date(at) } },
              { session },
            )
          )?.payload || null
        : null;
      await c.updateOne(
        { _id: id },
        { $set: { payload: merge(old, anonymous), expiresAt: expires } },
        { upsert: true, session },
      );
      if (owner && anonymous)
        await c.deleteOne({ _id: anonymousId }, { session });
    });
  } else {
    setup();
    transaction(() => {
      if (owner) {
        const consent = db()
          .prepare("SELECT payload FROM study_state WHERE id=?")
          .get(owner + ":growth-consent");
        if (!consent || JSON.parse(String(consent.payload)) !== true) return;
      }
      const read = (key: string) => {
        const r = db()
          .prepare(
            "SELECT payload FROM growth_metrics WHERE id=? AND expires_at>?",
          )
          .get(key, new Date(at).toISOString());
        return r ? JSON.parse(String(r.payload)) : null;
      };
      const row = merge(read(id), owner ? read(anonymousId) : null);
      db()
        .prepare(
          "INSERT INTO growth_metrics VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at",
        )
        .run(id, JSON.stringify(row), expires.toISOString());
      if (owner)
        db().prepare("DELETE FROM growth_metrics WHERE id=?").run(anonymousId);
      db()
        .prepare("DELETE FROM growth_metrics WHERE expires_at<=?")
        .run(new Date(at).toISOString());
    });
  }
}
export async function ownerMetric(
  owner: string,
  name: MetricEvent,
  resource: string,
) {
  if (!(await readState(owner, "growth-consent", false))) return;
  // Stable owner-scoped pseudonym; no email, note text, topic or URL is collected.
  const h = hash(owner);
  const visitor = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  await recordMetric(visitor, name, resource, owner);
}
export function summarizeMetrics(rows: Cohort[], at = Date.now()) {
  const has = (r: Cohort, n: MetricEvent) => r.events.some((e) => e.name === n);
  const count = (n: MetricEvent, subset = rows) =>
    subset.filter((r) => has(r, n)).length;
  const retention = (day: number) => {
    const eligible = rows.filter(
      (r) =>
        r.account &&
        r.events.some(
          (e) =>
            e.name === "signup_created" &&
            at - Date.parse(e.day + "T00:00Z") >= day * 86400000,
        ),
    );
    return {
      eligible: eligible.length,
      returned: eligible.filter((r) => {
        const start = r.events.find((e) => e.name === "signup_created")!.day;
        return r.days.includes(
          new Date(Date.parse(start + "T00:00Z") + day * 86400000)
            .toISOString()
            .slice(0, 10),
        );
      }).length,
    };
  };
  return {
    scope:
      "Consenting visitors/accounts only; browser events are estimates, not total site traffic.",
    visitors: rows.length,
    signup: count("signup_created"),
    firstNote: count("note_ready"),
    quiz: count("quiz_used"),
    flashcards: count("flashcard_used"),
    paid: count("paid"),
    referralShares: count("referral_share"),
    retention: { D1: retention(1), D7: retention(7), D30: retention(30) },
    variants: ["A", "B"].map((variant) => {
      const r = rows.filter((x) => x.variant === variant);
      return {
        variant,
        visitors: r.length,
        previewStarts: count("preview_start", r),
        previews: count("preview_ready", r),
        signups: count("signup_created", r),
      };
    }),
  };
}
export async function metricsReport() {
  let rows: Cohort[];
  if (useMongo())
    rows = (
      await (
        await collection("growth_metrics")
      )
        .find({ expiresAt: { $gt: new Date() } })
        .limit(10000)
        .toArray()
    ).map((r) => r.payload);
  else {
    setup();
    rows = db()
      .prepare(
        "SELECT payload FROM growth_metrics WHERE expires_at>? LIMIT 10000",
      )
      .all(new Date().toISOString())
      .map((r) => JSON.parse(String(r.payload)));
  }
  return { ...summarizeMetrics(rows), sampleLimit: 10000 };
}
