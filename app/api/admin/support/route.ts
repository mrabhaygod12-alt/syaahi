import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { adminScopes } from "@/lib/auth/admin";
import { supportAgents } from "@/lib/admin/accounts";
import {
  listTickets,
  findTicket,
  supportTicket,
  changeTicket,
  TICKET_STATUSES,
  TicketInputError,
  type SupportTicket,
} from "@/lib/support";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/admin/audit";
export const GET = apiHandler(async (req: Request) => {
  const user = await currentUser(req);
  if (!adminScopes(user).support)
    return NextResponse.json(
      { error: "Verified support administrator required." },
      { status: 403 },
    );
  const url = new URL(req.url),
    id = url.searchParams.get("id");
  if (id) {
    const ticket = id.length <= 80 ? await supportTicket(id) : null;
    if (!ticket)
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    await audit(user!.id, id, "support.view");
    return NextResponse.json({ ticket, agents: await supportAgents() });
  }
  const q = (url.searchParams.get("q") || "").trim().toLowerCase(),
    status = url.searchParams.get("status") || "all",
    workspace = url.searchParams.get("workspace") || "all";
  if (
    q.length > 120 ||
    (status !== "all" &&
      !(TICKET_STATUSES as readonly string[]).includes(status)) ||
    !["all", "student", "writer"].includes(workspace)
  )
    return NextResponse.json(
      { error: "Invalid ticket filter." },
      { status: 400 },
    );
  const tickets = await listTickets(undefined, { q, status, workspace });
  return NextResponse.json({
    tickets,
    limit: 100,
    agents: await supportAgents(),
  });
});
export const POST = apiHandler(async (req: Request) => {
  const user = await currentUser(req);
  if (!adminScopes(user).support)
    return NextResponse.json(
      { error: "Verified support administrator required." },
      { status: 403 },
    );
  const limited = await rateLimit(req, "admin-support", 30, 60000);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  try {
    if (
      typeof b?.id !== "string" ||
      b.id.length > 80 ||
      !Number.isInteger(b.revision) ||
      b.revision < 0
    )
      throw new TicketInputError("Include the ticket and current revision.");
    const item = await findTicket(b.id);
    if (!item) throw new TicketInputError("Ticket not found.", 404);
    const agents = b.action === "assign" ? await supportAgents() : [];
    const ticket = await changeTicket(
      item.user,
      item.id,
      (t) => {
        if (!t) throw new TicketInputError("Ticket not found.", 404);
        if ((t.revision || 0) !== b.revision)
          throw new TicketInputError(
            "This ticket changed. Reload before saving.",
            409,
          );
        if (b.action === "status") {
          if (!(TICKET_STATUSES as readonly string[]).includes(b.status))
            throw new TicketInputError("Invalid status.");
          return { ...t, status: b.status };
        }
        if (b.action === "priority") {
          if (!["normal", "high", "urgent"].includes(b.priority))
            throw new TicketInputError("Invalid priority.");
          return { ...t, priority: b.priority };
        }
        if (b.action === "assign") {
          if (
            b.assignedTo !== null &&
            !agents.some((a) => a.id === b.assignedTo)
          )
            throw new TicketInputError(
              "Choose an active support administrator.",
            );
          return { ...t, assignedTo: b.assignedTo };
        }
        const text = typeof b.message === "string" ? b.message.trim() : "";
        if (text.length < 2 || text.length > 4000)
          throw new TicketInputError("Use 2–4,000 characters.");
        if (b.action === "note") {
          if ((t.internalNotes?.length || 0) >= 100)
            throw new TicketInputError(
              "A ticket supports up to 100 internal notes.",
            );
          return {
            ...t,
            internalNotes: [
              ...(t.internalNotes || []),
              { actor: user!.id, text, at: new Date().toISOString() },
            ],
          };
        }
        if (b.action === "reply") {
          if (t.status === "closed" || t.messages.length >= 100)
            throw new TicketInputError(
              "Reopen closed tickets; a ticket supports up to 100 replies.",
            );
          return {
            ...t,
            status: "waiting",
            messages: [
              ...t.messages,
              { by: "support", text, at: new Date().toISOString() },
            ],
          } as SupportTicket;
        }
        throw new TicketInputError("Unknown ticket action.");
      },
      user!.id,
      b.action,
    );
    return NextResponse.json({ ticket });
  } catch (e) {
    if (!(e instanceof TicketInputError)) throw e;
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
});
