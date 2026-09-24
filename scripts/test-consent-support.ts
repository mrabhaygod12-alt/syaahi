import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-support-"));
async function main() {
  const auth = await import("../app/api/auth/route");
  const google = await import("../app/api/auth/google/route");
  const support = await import("../app/api/support/route");
  const server = await import("../lib/auth/server");
  const { readState } = await import("../lib/study/state");
  const request = (body?: unknown, cookie = "", path = "/api/auth") =>
    new NextRequest("http://localhost" + path, {
      method: body ? "POST" : "GET",
      headers: { cookie, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  const form = {
    mode: "signup",
    name: "Learner",
    email: "learner@example.test",
    password: "long-test-password",
  };
  assert.equal((await auth.POST(request(form))).status, 400);
  assert.equal(
    (await google.POST(request({ next: "/dashboard" }))).status,
    400,
  );
  const created = await auth.POST(
    request({ ...form, acceptTerms: true, termsVersion: "2026-09-24" }),
  );
  assert.equal(created.status, 200);
  const learner = (await created.json()).user;
  const cookie = created.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await readState(learner.id, "terms-consent", { version: "" })).version,
    "2026-09-24",
  );
  assert.equal(
    (await auth.POST(request({ ...form, mode: "login" }))).status,
    400,
  );
  const staff = await server.register(
    "Support",
    "staff@example.test",
    "long-test-password",
  );
  const stranger = await server.register(
    "Other",
    "other@example.test",
    "long-test-password",
  );
  process.env.SUPPORT_ADMIN_IDS = staff.id;
  const staffCookie = (await server.startSession(staff, request())).headers
    .get("set-cookie")!
    .split(";")[0];
  const otherCookie = (await server.startSession(stranger, request())).headers
    .get("set-cookie")!
    .split(";")[0];
  const opened = await support.POST(
    request(
      {
        action: "create",
        subject: "PDF export issue",
        category: "generation",
        message:
          "My exported notes appear with an unexpected blank final sheet.",
      },
      cookie,
    ),
  );
  assert.equal(opened.status, 201);
  const ticket = (await opened.json()).ticket;
  assert.equal(
    (
      await support.GET(
        request(undefined, otherCookie, "/api/support?id=" + ticket.id),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await support.POST(
        request(
          {
            action: "reply",
            id: ticket.id,
            message: "Please provide the lesson ID.",
          },
          staffCookie,
        ),
      )
    ).status,
    200,
  );
  const thread = await (
    await support.GET(
      request(undefined, cookie, "/api/support?id=" + ticket.id),
    )
  ).json();
  assert.equal(thread.ticket.messages[1].by, "support");
  assert.equal(thread.ticket.status, "waiting");
  assert.equal(
    (await support.POST(request({ action: "resolve", id: ticket.id }, cookie)))
      .status,
    200,
  );
  console.log(
    "PASS: consent enforced for password and Google entry, consent version stored, private support ticket, staff reply and resolution.",
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
