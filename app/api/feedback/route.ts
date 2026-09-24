import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { mutateState, readState } from "@/lib/study/state";
import { rateLimit } from "@/lib/ratelimit";
interface Feedback {
  at: string;
  q: string;
  a: string;
  verdict: "up" | "down";
  jobId: string;
}
async function handlePOST(req: Request) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "feedback", 30, 60000));
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  if (typeof b.q !== "string" || !b.q.trim())
    return NextResponse.json({ error: "Provide a question." }, { status: 400 });
  const entry: Feedback = {
    at: new Date().toISOString(),
    q: b.q.slice(0, 500),
    a: String(b.a || "").slice(0, 2000),
    verdict: b.verdict === "up" ? "up" : "down",
    jobId: String(b.jobId || "").slice(0, 50),
  };
  const saved = await mutateState<Feedback[]>(
    (await currentUser(req))!.id,
    "feedback",
    [],
    (items) => [entry, ...items].slice(0, 200),
  );
  return NextResponse.json({ ok: true, total: saved.length });
}
async function handleGET(req: Request) {
  const denied = await authError(req);
  if (denied) return denied;
  const rows = await readState<Feedback[]>(
    (await currentUser(req))!.id,
    "feedback",
    [],
  );
  const down = rows.filter((r) => r.verdict === "down").length;
  return NextResponse.json(
    { total: rows.length, down, up: rows.length - down },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const POST = apiHandler(handlePOST);
export const GET = apiHandler(handleGET);
