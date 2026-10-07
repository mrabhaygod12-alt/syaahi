import { apiHandler } from "@/lib/api-handler";
import {
  listTickets,
  findTicket,
  supportTicket,
  changeTicket,
  publicTicket,
  publicTicketIndex,
  TicketInputError,
  type SupportTicket,
} from "@/lib/support";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { writerAccess } from "@/lib/writing/profile";
import { adminScopes } from "@/lib/auth/admin";
async function access(req: Request) {
  const user = await currentUser(req);
  if (!user)
    return {
      denied: NextResponse.json(
        { error: "Sign in to contact support." },
        { status: 401 },
      ),
    };
  const workspace = new URL(req.url).pathname.startsWith("/api/writer/")
    ? ("writer" as const)
    : ("student" as const);
  if (workspace === "writer") {
    const denied = await writerAccess(user.id);
    if (denied) return { denied };
  }
  return { user, workspace, admin: adminScopes(user).support };
}
async function handleGET(req: Request) {
  const a = await access(req);
  if (a.denied) return a.denied;
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const ticket = id.length <= 80 ? await supportTicket(id) : null;
    if (
      !ticket ||
      (!a.admin &&
        (ticket.user !== a.user!.id ||
          (ticket.workspace || "student") !== a.workspace))
    )
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    return NextResponse.json({
      ticket: a.admin ? ticket : publicTicket(ticket),
      admin: a.admin,
    });
  }
  const tickets = await listTickets(a.admin ? undefined : a.user!.id);
  return NextResponse.json({
    tickets: tickets
      .filter((t) => a.admin || (t.workspace || "student") === a.workspace)
      .map((t) => (a.admin ? t : publicTicketIndex(t))),
    admin: a.admin,
  });
}
async function handlePOST(req: Request) {
  const a = await access(req);
  if (a.denied) return a.denied;
  const limited = await rateLimit(req, "support", 12, 60000);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  try {
    if (b?.action === "create") {
      const subject = typeof b.subject === "string" ? b.subject.trim() : "",
        text = typeof b.message === "string" ? b.message.trim() : "";
      if (
        subject.length < 5 ||
        subject.length > 120 ||
        text.length < 20 ||
        text.length > 4000
      )
        throw new TicketInputError(
          "Use a subject of 5–120 characters and a message of 20–4,000 characters.",
        );
      const id =
          typeof b.requestId === "string" &&
          /^[a-f0-9-]{36}$/i.test(b.requestId)
            ? b.requestId
            : randomUUID(),
        at = new Date().toISOString();
      const ticket = await changeTicket(
        a.user!.id,
        id,
        () => ({
          id,
          user: a.user!.id,
          workspace: a.workspace!,
          subject,
          category: [
            "account",
            "payment",
            "generation",
            "writing",
            "publishing",
            "privacy",
            "bug",
            "feature",
            "other",
          ].includes(b.category)
            ? b.category
            : "other",
          status: "open",
          createdAt: at,
          messages: [{ by: "learner", text, at }],
        }),
        undefined,
        "create",
        true,
      );
      return NextResponse.json(
        { ticket: publicTicket(ticket) },
        { status: 201 },
      );
    }
    const item =
      typeof b?.id === "string" && b.id.length <= 80
        ? await findTicket(b.id)
        : null;
    if (
      !item ||
      (!a.admin &&
        (item.user !== a.user!.id ||
          (item.workspace || "student") !== a.workspace))
    )
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    const ticket = await changeTicket(
      item.user,
      item.id,
      (t) => {
        if (!t) throw new TicketInputError("Ticket unavailable.", 404);
        if (b.action === "reply") {
          const text = typeof b.message === "string" ? b.message.trim() : "";
          if (t.status === "closed")
            throw new TicketInputError(
              "Reopen this ticket before replying.",
              409,
            );
          if (text.length < 2 || text.length > 4000 || t.messages.length >= 100)
            throw new TicketInputError(
              "Use 2–4,000 characters; a ticket supports up to 100 messages.",
            );
          return {
            ...t,
            messages: [
              ...t.messages,
              {
                by: a.admin ? "support" : "learner",
                text,
                at: new Date().toISOString(),
              },
            ],
            status: a.admin ? "waiting" : "open",
          } as SupportTicket;
        }
        if (b.action === "resolve") return { ...t, status: "resolved" };
        if (b.action === "reopen") return { ...t, status: "open" };
        if (b.action === "close") return { ...t, status: "closed" };
        throw new TicketInputError("Unknown ticket action.");
      },
      a.admin ? a.user!.id : undefined,
      b.action,
    );
    return NextResponse.json({
      ticket: a.admin ? ticket : publicTicket(ticket),
    });
  } catch (e) {
    if (!(e instanceof TicketInputError)) throw e;
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
