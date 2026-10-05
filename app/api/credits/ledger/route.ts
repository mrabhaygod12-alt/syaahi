import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  const owner = (await currentUser(req))!.id;
  const entries = useMongo()
    ? (
        await (
          await collection("ledger")
        )
          .find({ user: owner })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray()
      ).map((r) => ({
        reference: String(r._id),
        delta: r.delta,
        reason: r.reason,
        at: r.createdAt,
      }))
    : db()
        .prepare(
          "SELECT id AS reference,delta,reason,created_at AS at FROM ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
        )
        .all(owner);
  return NextResponse.json({ entries });
});
