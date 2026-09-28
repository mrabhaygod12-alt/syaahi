import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";

async function main() {
  const replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.12" },
  });
  process.env.MONGODB_URI = replica.getUri();
  process.env.DATA_BACKEND = "mongo";
  process.env.MONGODB_DATABASE = "support_test";
  process.env.NEXT_PUBLIC_APP_URL = "https://www.syaahii.in";
  try {
    const { register, startSession } = await import("../lib/auth/server");
    const { markEmailVerified } = await import("../lib/billing/rewards");
    const { GET, POST } = await import("../app/api/support/route");
    const origin = "https://www.syaahii.in";
    const cookies: string[] = [];
    for (const name of ["Learner", "Other"]) {
      const user = await register(
        name,
        `${name.toLowerCase()}@example.test`,
        "test-password-12345",
      );
      await markEmailVerified(user.id);
      cookies.push(
        (await startSession(user, new Request(origin))).headers
          .get("set-cookie")!
          .split(";")[0],
      );
    }
    const get = (query = "", cookie = cookies[0]) =>
      GET(
        new Request(origin + "/api/support" + query, { headers: { cookie } }),
      );
    const post = (body: unknown, cookie = cookies[0]) =>
      POST(
        new Request(origin + "/api/support", {
          method: "POST",
          headers: { origin, cookie, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    assert.equal((await get("", "")).status, 401);
    assert.deepEqual((await (await get()).json()).tickets, []);
    const created = await post({
      action: "create",
      subject: "Payment question",
      message: "Please help with my payment status and study credits.",
      category: "payment",
    });
    assert.equal(created.status, 201);
    const { ticket } = await created.json();
    assert.equal((await (await get()).json()).tickets.length, 1);
    assert.equal((await get(`?id=${ticket.id}`, cookies[1])).status, 404);
    assert.equal(
      (
        await post(
          { action: "reply", id: ticket.id, message: "Not my ticket" },
          cookies[1],
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await post({
          action: "reply",
          id: ticket.id,
          message: "Additional details for support.",
        })
      ).status,
      200,
    );
    assert.equal(
      (await (await get(`?id=${ticket.id}`)).json()).ticket.messages.length,
      2,
    );
    assert.equal(
      (await post({ action: "resolve", id: ticket.id })).status,
      200,
    );
    assert.equal((await (await get()).json()).tickets[0].status, "resolved");
    console.log(
      "PASS: authenticated Mongo support inbox, create, reply, resolve, guest handling and cross-account isolation.",
    );
  } finally {
    const { mongo } = await import("../lib/storage/mongo");
    await (await mongo()).client.close();
    await replica.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
