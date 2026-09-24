import { apiHandler } from "@/lib/api-handler";
import { listTickets, findTicket, saveTicketIndex } from "@/lib/support";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { authError, currentUser } from "@/lib/auth/server";
import { readState, mutateState } from "@/lib/study/state";
import { rateLimit } from "@/lib/ratelimit";
interface Message {
  by: "learner" | "support";
  text: string;
  at: string;
}
class TicketInputError extends Error {}
interface Ticket {
  id: string;
  user: string;
  subject: string;
  category: string;
  status: "open" | "waiting" | "resolved";
  createdAt: string;
  messages: Message[];
}
const admin = (id: string) =>
  (process.env.SUPPORT_ADMIN_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .includes(id);
async function handleGET(req: Request) {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const isAdmin = admin(user.id);
  const id = new URL(req.url).searchParams.get("id");
  const tickets = await listTickets(isAdmin ? undefined : user.id);
  if (id) {
    const item = await findTicket(id);
    if (!item || (!isAdmin && item.user !== user.id))
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    return NextResponse.json(
      {
        ticket: await readState<Ticket | null>(
          item.user,
          `support:${id}`,
          null,
        ),
        admin: isAdmin,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      tickets: tickets
        .filter((t) => isAdmin || t.user === user.id)
        .slice(0, 100),
      admin: isAdmin,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
async function handlePOST(req: Request) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "support", 12, 60000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const b = await req.json().catch(() => ({}));
  const isAdmin = admin(user.id);
  try {
    if (b.action === "create") {
      const subject = String(b.subject || "").trim(),
        text = String(b.message || "").trim();
      if (
        subject.length < 5 ||
        subject.length > 120 ||
        text.length < 20 ||
        text.length > 4000
      )
        throw new TicketInputError(
          "Use a subject of 5–120 characters and a message of 20–4,000 characters.",
        );
      const existing = await listTickets(user.id);
      if (
        existing.filter((t) => t.user === user.id && t.status !== "resolved")
          .length >= 10
      )
        throw new TicketInputError(
          "You already have 10 active tickets. Reply to an existing ticket.",
        );
      const ticket: Ticket = {
        id: randomUUID(),
        user: user.id,
        subject,
        category: [
          "account",
          "payment",
          "generation",
          "privacy",
          "other",
        ].includes(b.category)
          ? b.category
          : "other",
        status: "open",
        createdAt: new Date().toISOString(),
        messages: [{ by: "learner", text, at: new Date().toISOString() }],
      };
      await mutateState<Ticket>(
        user.id,
        `support:${ticket.id}`,
        ticket,
        () => ticket,
      );
      await saveTicketIndex({
        id: ticket.id,
        user: user.id,
        subject,
        category: ticket.category,
        status: ticket.status,
        createdAt: ticket.createdAt,
      });
      return NextResponse.json({ ticket }, { status: 201 });
    }
    const item = await findTicket(String(b.id || ""));
    if (!item || (!isAdmin && item.user !== user.id))
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    const ticket = await mutateState<Ticket | null>(
      item.user,
      `support:${item.id}`,
      null,
      (t) => {
        if (!t) throw new TicketInputError("Ticket unavailable.");
        if (b.action === "reply") {
          const text = String(b.message || "").trim();
          if (text.length < 2 || text.length > 4000 || t.messages.length >= 100)
            throw new TicketInputError(
              "Use 2–4,000 characters; a ticket supports up to 100 messages.",
            );
          t.messages.push({
            by: isAdmin ? "support" : "learner",
            text,
            at: new Date().toISOString(),
          });
          t.status = isAdmin ? "waiting" : "open";
        } else if (b.action === "resolve") t.status = "resolved";
        else if (b.action === "reopen") t.status = "open";
        else throw new TicketInputError("Unknown ticket action.");
        return t;
      },
    );
    await saveTicketIndex({ ...item, status: ticket!.status });
    return NextResponse.json({ ticket });
  } catch (e) {
    if (!(e instanceof TicketInputError)) throw e;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save your ticket." },
      { status: 400 },
    );
  }
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
