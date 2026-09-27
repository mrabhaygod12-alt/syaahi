import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { NextRequest } from "next/server";

async function main() {
  const replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.12" },
  });
  process.env.MONGODB_URI = replica.getUri();
  process.env.DATA_BACKEND = "mongo";
  process.env.MONGODB_DATABASE = "payment_status_test";
  process.env.NEXT_PUBLIC_APP_URL = "https://www.syaahii.in";
  try {
    const { register, startSession } = await import("../lib/auth/server");
    const { saveOrder, userOrders } = await import("../lib/billing/orders");
    const { capturePayment } = await import("../lib/billing/payments");
    const { GET } = await import("../app/api/razorpay/orders/route");
    const user = await register(
      "Buyer",
      "status-buyer@example.test",
      "test-password-12345",
    );
    const other = await register(
      "Other",
      "status-other@example.test",
      "test-password-12345",
    );
    const origin = "https://www.syaahii.in";
    const { markEmailVerified } = await import("../lib/billing/rewards");
    await markEmailVerified(user.id);
    const session = await startSession(user, new Request(origin));
    const cookie = session.headers.get("set-cookie")!.split(";")[0];
    await saveOrder("order_StatusOne", user.id, "try", 900, 3);
    await saveOrder("order_StatusOther", other.id, "try", 900, 3);
    const get = (path: string, authenticated = true) =>
      GET(
        new NextRequest(origin + path, {
          headers: authenticated ? { cookie } : {},
        }),
      );
    assert.equal((await get("/api/razorpay/orders", false)).status, 401);
    assert.equal(
      (await get("/api/razorpay/orders?order=order_StatusOther")).status,
      404,
    );
    assert.equal((await get("/api/razorpay/orders?order=bad")).status, 400);
    const list = await (await get("/api/razorpay/orders")).json();
    assert.equal(list.orders.length, 1);
    assert.equal(list.orders[0].paid, false);
    assert.equal(list.orders[0].user, undefined);
    assert.equal(list.orders[0].keyId, undefined);
    await assert.rejects(
      capturePayment(
        {
          id: "pay_StatusOne",
          order_id: "order_StatusOne",
          amount: 900,
          currency: "INR",
          status: "authorized",
        },
        user.id,
      ),
    );
    assert.equal((await userOrders(user.id))[0].paid, false);
    const payment = {
      id: "pay_StatusOne",
      order_id: "order_StatusOne",
      amount: 900,
      currency: "INR",
      status: "captured",
    };
    await Promise.all([
      capturePayment(payment, user.id),
      capturePayment(payment, user.id),
    ]);
    const status = await get("/api/razorpay/orders?order=order_StatusOne");
    assert.equal(status.headers.get("cache-control"), "no-store");
    assert.equal((await status.json()).orders[0].paid, true);
    console.log(
      "PASS payment status: authentication, account isolation, no secret fields, captured-only state and replay safety.",
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
