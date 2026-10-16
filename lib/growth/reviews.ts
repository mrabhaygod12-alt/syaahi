import { createHash } from "node:crypto";
import { REVIEW_TOPICS, type ReviewTopic } from "./review-topics";
import type { Account } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
import {
  mutateRecord,
  record,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
export class ReviewError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export interface Testimonial extends WorkspaceRecord {
  category?: ReviewTopic;
  kind: "testimonial";
  stars: number;
  text: string;
  displayName: string;
  verified: true;
  consent: true;
  status: "pending" | "published" | "rejected";
  fingerprint: string;
  revision: number;
  createdAt: string;
  moderation?: { actor: string; action: string; reason: string; at: string }[];
}
export async function reviewEligibility(user: Account) {
  if (!user.verified) return false;
  if (useMongo()) {
    return (
      Boolean(
        await (
          await collection("jobs")
        ).findOne({ user: user.id, status: "done" }),
      ) ||
      Boolean(
        await (
          await collection("stories")
        ).findOne({ user: user.id, status: "published" }),
      )
    );
  }
  return (
    Boolean(
      db()
        .prepare(
          "SELECT id FROM jobs WHERE user_id=? AND status='done' LIMIT 1",
        )
        .get(user.id),
    ) ||
    Boolean(
      db()
        .prepare(
          "SELECT id FROM stories WHERE user_id=? AND status='published' LIMIT 1",
        )
        .get(user.id),
    )
  );
}
export function reviewInput(body: any) {
  // Pass 1: deterministic validation before storage, not a client-side trust flag.
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    body.website ||
    body.consent !== true
  )
    throw new ReviewError(
      "Confirm public display consent and submit the review form.",
    );
  const text =
    typeof body.text === "string" ? body.text.trim().normalize("NFKC") : "";
  if (
    body.category !== undefined &&
    !Object.prototype.hasOwnProperty.call(REVIEW_TOPICS, body.category)
  )
    throw new ReviewError("Choose a supported feedback topic.");
  if (
    !Number.isInteger(body.stars) ||
    body.stars < 1 ||
    body.stars > 5 ||
    text.length < 40 ||
    text.length > 800
  )
    throw new ReviewError(
      "Choose 1–5 stars and write 40–800 characters about your experience.",
    );
  if (
    /https?:\/\/|www\.|<[^>]+>|(.)\1{12,}/iu.test(text) ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(text)
  )
    throw new ReviewError(
      "Remove links, markup or repeated promotional text from your review.",
    );
  return {
    category: (body.category || "general") as ReviewTopic,
    stars: body.stars as number,
    text,
    fingerprint: createHash("sha256")
      .update(text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))
      .digest("hex"),
  };
}
export async function submitReview(user: Account, body: unknown) {
  const input = reviewInput(body);
  if (!(await reviewEligibility(user)))
    throw new ReviewError(
      "Verify your email and complete a lesson or publish a story before reviewing Syaahii.",
      403,
    );
  // Pass 2: account/product eligibility, duplicate evidence and human moderation.
  const duplicate = useMongo()
    ? await (
        await collection("workspace_records")
      ).findOne({
        kind: "testimonial",
        owner: { $ne: user.id },
        "payload.fingerprint": input.fingerprint,
      })
    : db()
        .prepare(
          "SELECT id FROM workspace_records WHERE kind='testimonial' AND owner<>? AND json_extract(payload,'$.fingerprint')=? LIMIT 1",
        )
        .get(user.id, input.fingerprint);
  if (duplicate)
    throw new ReviewError(
      "Write your own experience instead of copying an existing review.",
      409,
    );
  return mutateRecord<Testimonial>(`testimonial-${user.id}`, (old) => {
    if (
      old &&
      body &&
      typeof body === "object" &&
      (body as any).revision !== old.revision
    )
      throw new ReviewError(
        "This review changed. Reload before editing it.",
        409,
      );
    const now = new Date().toISOString();
    return {
      id: `testimonial-${user.id}`,
      owner: user.id,
      kind: "testimonial",
      ...input,
      displayName: user.name.slice(0, 70),
      verified: true,
      consent: true,
      status: "pending",
      revision: (old?.revision || 0) + 1,
      createdAt: old?.createdAt || now,
      updatedAt: now,
      moderation: old?.moderation || [],
    };
  });
}
export async function reviewList(status?: Testimonial["status"], limit = 50) {
  if (useMongo())
    return (
      await (
        await collection("workspace_records")
      )
        .find({
          kind: "testimonial",
          ...(status ? { "payload.status": status } : {}),
        })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .toArray()
    ).map((row) => row.payload as Testimonial);
  return db()
    .prepare(
      `SELECT payload FROM workspace_records WHERE kind='testimonial' ${status ? "AND json_extract(payload,'$.status')=?" : ""} ORDER BY updated_at DESC LIMIT ?`,
    )
    .all(...(status ? [status, limit] : [limit]))
    .map((row) => JSON.parse(String(row.payload)) as Testimonial);
}
export async function publicReviews() {
  const reviews = await reviewList("published", 12);
  return reviews.map(({ id, displayName, stars, text, updatedAt }) => ({
    id,
    displayName,
    stars,
    text,
    updatedAt,
    verified: true as const,
  }));
}
export async function moderateReview(
  id: string,
  action: "publish" | "reject",
  actor: string,
  revision: number,
  reason: string,
) {
  const existing = await record<Testimonial>(id);
  if (!existing || existing.kind !== "testimonial")
    throw new ReviewError("Review not found.", 404);
  if (existing.owner === actor)
    throw new ReviewError(
      "Another editor must review your own testimonial.",
      403,
    );
  if (action === "publish") {
    await mutateRecord<WorkspaceRecord & { review: string }>(
      `testimonial-fingerprint-${existing.fingerprint}`,
      (old) => {
        if (old && old.review !== id)
          throw new ReviewError(
            "A matching review has already been approved.",
            409,
          );
        return {
          id: `testimonial-fingerprint-${existing.fingerprint}`,
          owner: actor,
          kind: "testimonial-fingerprint",
          review: id,
          updatedAt: new Date().toISOString(),
        };
      },
    );
  }
  return mutateRecord<Testimonial>(id, (old) => {
    if (!old || old.kind !== "testimonial")
      throw new ReviewError("Review not found.", 404);
    if (old.revision !== revision)
      throw new ReviewError("Review changed. Reload before moderating.", 409);
    const now = new Date().toISOString();
    return {
      ...old,
      status: action === "publish" ? "published" : "rejected",
      updatedAt: now,
      revision: old.revision + 1,
      moderation: [
        ...(old.moderation || []),
        { actor, action, reason: reason.slice(0, 400), at: now },
      ].slice(-30),
    };
  });
}
