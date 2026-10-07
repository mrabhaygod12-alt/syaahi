import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { adminScopes } from "@/lib/auth/admin";
import {
  managedUsers,
  changeManagedUser,
  AdminInputError,
} from "@/lib/admin/accounts";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/admin/audit";
export const GET = apiHandler(async (req: Request) => {
  const u = await currentUser(req);
  if (!adminScopes(u).users)
    return NextResponse.json(
      { error: "Verified user administrator required." },
      { status: 403 },
    );
  const url = new URL(req.url),
    id = url.searchParams.get("id");
  try {
    const users = await managedUsers(
      id || (url.searchParams.get("q") || "").trim(),
      url.searchParams.get("status") || "all",
    );
    if (!id) return NextResponse.json({ users, limit: 100 });
    const user = users.find((x) => x.id === id);
    if (!user)
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    const { balance } = await import("@/lib/credits/store"),
      { userOrders } = await import("@/lib/billing/orders"),
      { listStories } = await import("@/lib/writing/stories"),
      { listTickets } = await import("@/lib/support");
    const { currentSubscription } = await import("@/lib/billing/subscriptions");
    const [credits, orders, stories, tickets, subscription] = await Promise.all(
      [
        balance(id),
        userOrders(id),
        listStories(id),
        listTickets(id),
        currentSubscription(id),
      ],
    );
    await audit(u!.id, id, "account.view");
    return NextResponse.json({
      user,
      activity: {
        credits,
        orders,
        subscription,
        stories: stories.map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          updatedAt: s.updatedAt,
          slug: s.slug,
        })),
        tickets,
      },
    });
  } catch (e) {
    if (!(e instanceof AdminInputError)) throw e;
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
});
export const POST = apiHandler(async (req: Request) => {
  const u = await currentUser(req);
  if (!adminScopes(u).users)
    return NextResponse.json(
      { error: "Verified user administrator required." },
      { status: 403 },
    );
  const limited = await rateLimit(req, "admin-user-change", 20, 60000);
  if (limited) return limited;
  try {
    return NextResponse.json({
      control: await changeManagedUser(u!, await req.json()),
    });
  } catch (e) {
    if (!(e instanceof AdminInputError)) throw e;
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
});
