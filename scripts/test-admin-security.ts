import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-admin-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.APP_ROLE = "all";
process.env.ADMIN_MFA_ENFORCE = "1";
process.env.ADMIN_MFA_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.ADMIN_EMAILS = "root@example.test";
process.env.WORKER_MODE = "external";
async function main() {
  let replica: any;
  if (process.argv.includes("--mongo")) {
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replica.getUri();
    process.env.DATA_BACKEND = "mongo";
  }
  try {
    const auth = await import("../lib/auth/server"),
      mfa = await import("../lib/auth/admin-mfa"),
      { adminScopes, adminEligibility } = await import("../lib/auth/admin"),
      { markEmailVerified } = await import("../lib/billing/rewards"),
      sessions = await import("../lib/auth/session-security"),
      accounts = await import("../lib/admin/accounts"),
      state = await import("../lib/study/state"),
      { recentAudit } = await import("../lib/admin/audit");
    for (const [time, expected] of [
      [59, "287082"],
      [1111111109, "081804"],
      [1111111111, "050471"],
      [1234567890, "005924"],
      [2000000000, "279037"],
      [20000000000, "353130"],
    ] as const)
      assert.equal(
        mfa.totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", Math.floor(time / 30)),
        expected,
        "RFC 6238 SHA-1 vector",
      );
    const root = await auth.register(
        "Root",
        "root@example.test",
        "admin-safe-password",
      ),
      learner = await auth.register(
        "Learner",
        "learner@example.test",
        "learner-safe-password",
      ),
      other = await auth.register(
        "Other",
        "other@example.test",
        "other-safe-password",
      );
    for (const u of [root, learner, other]) await markEmailVerified(u.id);
    const cookie = async (u: any) =>
      (
        await auth.startSession(
          u,
          new Request("https://www.syaahii.in", {
            headers: { "user-agent": "Synthetic test device" },
          }),
        )
      ).headers
        .get("set-cookie")!
        .split(";")[0];
    const own = await cookie(learner),
      foreign = await cookie(other),
      first = await cookie(root),
      second = await cookie(root);
    const req = (path: string, body?: unknown, c = first) =>
      new NextRequest("https://www.syaahii.in" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          origin: "https://www.syaahii.in",
          cookie: c,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const asUser = async (c: string) =>
      (await auth.currentUser(req("/api/auth", undefined, c)))!;
    const adminUsers = await import("../app/api/admin/users/route"),
      adminSupport = await import("../app/api/admin/support/route"),
      apiSupport = await import("../app/api/support/route"),
      upi = await import("../app/api/upi/admin/route"),
      apiAuth = await import("../app/api/auth/route");
    assert.equal((await adminUsers.GET(req("/api/admin/users"))).status, 403);
    assert.equal((await upi.GET(req("/api/upi/admin"))).status, 403);
    assert.equal(
      (await adminSupport.GET(req("/api/admin/support", undefined, own)))
        .status,
      403,
    );
    assert.equal(adminEligibility(await asUser(first)).users, true);
    assert.equal(adminScopes(await asUser(first)).users, false);
    await assert.rejects(() =>
      mfa.beginMfa(
        learner,
        req("/api/admin/mfa", undefined, own),
        "learner-safe-password",
      ),
    );
    await assert.rejects(() =>
      mfa.beginMfa(root, req("/api/admin/mfa"), "wrong-password"),
    );
    const setup = await mfa.beginMfa(
      await asUser(first),
      req("/api/admin/mfa"),
      "admin-safe-password",
    );
    assert.match(setup.secret, /^[A-Z2-7]{32}$/);
    const factor = await state.readState<any>(root.id, "admin-mfa", {});
    assert(
      !JSON.stringify(factor).includes(setup.secret),
      "Authenticator secret is encrypted at rest",
    );
    await assert.rejects(
      async () =>
        mfa.confirmMfa(
          await asUser(second),
          req("/api/admin/mfa", undefined, second),
          setup.id,
          mfa.totp(setup.secret),
        ),
      /Setup expired or changed/,
    );
    if (!replica) {
      const { db } = await import("../lib/db");
      db().exec(
        "CREATE TRIGGER simulate_audit_outage BEFORE INSERT ON admin_audit WHEN json_extract(NEW.payload,'$.action')='mfa.enrolled' BEGIN SELECT RAISE(ABORT,'Simulated audit outage'); END",
      );
      await assert.rejects(
        async () =>
          mfa.confirmMfa(
            await asUser(first),
            req("/api/admin/mfa"),
            setup.id,
            mfa.totp(setup.secret),
          ),
        /audit outage/,
      );
      assert.equal(
        (await state.readState<any>(root.id, "admin-mfa", {})).enabledAt,
        undefined,
        "Audit failure rolls back enrollment and OTP consumption",
      );
      assert.equal(adminScopes(await asUser(first)).users, false);
      db().exec("DROP TRIGGER simulate_audit_outage");
    }
    const codes = await mfa.confirmMfa(
      await asUser(first),
      req("/api/admin/mfa"),
      setup.id,
      mfa.totp(setup.secret),
    );
    assert.equal(codes.length, 8);
    assert.equal(adminScopes(await asUser(first)).users, true);
    assert.equal(
      adminScopes(await asUser(second)).users,
      false,
      "MFA elevation is specific to one session",
    );
    assert(
      !JSON.stringify(await asUser(first)).includes("adminAuthenticated"),
      "Privilege context never appears in public account DTO",
    );
    await assert.rejects(
      async () =>
        mfa.challengeMfa(
          await asUser(first),
          req("/api/admin/mfa"),
          mfa.totp(setup.secret),
        ),
      /already used/,
    );
    const race = await Promise.allSettled([
      mfa.challengeMfa(
        await asUser(second),
        req("/api/admin/mfa", undefined, second),
        codes[0],
      ),
      mfa.challengeMfa(
        await asUser(second),
        req("/api/admin/mfa", undefined, second),
        codes[0],
      ),
    ]);
    assert.equal(
      race.filter((r) => r.status === "fulfilled").length,
      1,
      "Recovery code cannot be replayed concurrently",
    );
    const privileged = await asUser(first);
    assert.equal((await adminUsers.GET(req("/api/admin/users"))).status, 200);
    const devices = await sessions.activeSessions(
      root.id,
      sessions.sessionKey(req("/api/auth")),
    );
    assert.equal(devices.length, 2);
    assert.equal(
      await sessions.revokeSessions(learner.id, devices[1].id),
      0,
      "Session revocation cannot cross owners",
    );
    assert.equal(
      await sessions.revokeSessions(
        root.id,
        undefined,
        sessions.sessionKey(req("/api/auth")),
      ),
      1,
    );
    assert.equal(
      await auth.currentUser(req("/api/auth", undefined, second)),
      null,
    );
    const grant = {
      id: other.id,
      version: 0,
      action: "role",
      role: "support",
      reason: "Support team test assignment",
    };
    await accounts.changeManagedUser(privileged, grant);
    await assert.rejects(
      () => accounts.changeManagedUser(privileged, grant),
      /changed/,
    );
    assert.equal(
      await auth.currentUser(req("/api/auth", undefined, foreign)),
      null,
      "Role changes revoke sessions",
    );
    assert((await accounts.supportAgents()).some((a) => a.id === other.id));
    await assert.rejects(
      () =>
        accounts.changeManagedUser(privileged, {
          id: root.id,
          version: 0,
          action: "role",
          role: "none",
          reason: "Cannot remove own access",
        }),
      /Another verified/,
    );
    const id = randomUUID();
    const create = () =>
      apiSupport.POST(
        req(
          "/api/support",
          {
            action: "create",
            requestId: id,
            subject: "Preview formatting issue",
            message: "My saved university note needs a formatting review.",
            category: "bug",
          },
          own,
        ),
      );
    assert.equal((await create()).status, 201);
    assert.equal((await create()).status, 201);
    const supportStore = await import("../lib/support");
    assert.equal(
      (await supportStore.listTickets(learner.id)).length,
      1,
      "Create retries do not duplicate conversations",
    );
    let t = (await supportStore.supportTicket(id))!;
    const change = async (action: string, extra: any) => {
      const r = await adminSupport.POST(
        req("/api/admin/support", {
          id,
          revision: t.revision || 0,
          action,
          ...extra,
        }),
      );
      assert.equal(r.status, 200, await r.clone().text());
      t = (await r.json()).ticket;
    };
    await change("note", {
      message: "Private investigator note, never show the learner.",
    });
    await change("priority", { priority: "urgent" });
    await change("assign", { assignedTo: other.id });
    await change("status", { status: "in_progress" });
    await change("reply", {
      message: "We are reviewing the saved note formatting.",
    });
    const read = await apiSupport.GET(
        req("/api/support?id=" + id, undefined, own),
      ),
      publicData = await read.json();
    assert.equal(publicData.ticket.status, "waiting");
    assert.equal(publicData.ticket.messages.length, 2);
    assert.equal(publicData.ticket.internalNotes, undefined);
    assert.equal(publicData.ticket.assignedTo, undefined);
    assert(!JSON.stringify(publicData).includes("Private investigator"));
    assert.equal(
      (
        await apiSupport.GET(
          req("/api/support?id=" + id, undefined, await cookie(other)),
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await adminSupport.POST(
          req("/api/admin/support", {
            id,
            revision: 0,
            action: "status",
            status: "closed",
          }),
        )
      ).status,
      409,
    );
    assert.equal((await supportStore.findTicket(id))!.status, t.status);
    assert.equal((await supportStore.listTickets(undefined, { q: "Preview formatting", workspace: "student", status: "waiting" })).length, 1);
    assert.equal((await supportStore.listTickets(undefined, { q: "[.*", status: "waiting" })).length, 0, "Search characters are literal, not regex operators");
    await assert.rejects(
      () =>
        supportStore.changeTicket(
          other.id,
          id,
          () => ({ ...t, user: other.id }),
          undefined,
          "create",
          true,
        ),
      /accepted/,
    );
    const before = (await supportStore.supportTicket(id))!.revision;
    await assert.rejects(() =>
      supportStore.changeTicket(learner.id, id, (old) => {
        old!.status = "closed";
        throw new Error("Simulated failed write");
      }),
    );
    assert.equal((await supportStore.supportTicket(id))!.revision, before);
    await accounts.changeManagedUser(privileged, {
      id: learner.id,
      version: 0,
      action: "access",
      status: "suspended",
      reason: "Synthetic account suspension test",
    });
    assert.equal(
      await auth.currentUser(req("/api/auth", undefined, own)),
      null,
    );
    const login = await apiAuth.POST(
      req(
        "/api/auth",
        {
          mode: "login",
          email: learner.email,
          password: "learner-safe-password",
          workspace: "student",
          acceptTerms: true,
          termsVersion: "2026-10-03",
        },
        own,
      ),
    );
    assert.equal(login.status, 403);
    assert.equal((await login.json()).code, "ACCOUNT_DISABLED");
    await accounts.changeManagedUser(privileged, {
      id: learner.id,
      version: 1,
      action: "access",
      status: "active",
      reason: "Restore synthetic account access",
    });
    assert(await asUser(await cookie(learner)));
    const log = await recentAudit();
    assert(log.some((e) => e.action === "support.note"));
    assert(log.some((e) => e.action === "mfa.recovery_used"));
    assert(log.some((e) => e.action === "account.access"));
    assert(!JSON.stringify(log).includes(setup.secret));
    assert(!JSON.stringify(log).includes(codes[0]));
    await accounts.changeManagedUser(privileged, { id: other.id, version: 1, action: "role", role: "admin", reason: "Second synthetic administrator for concurrency test" });
    const otherCookie = await cookie(other), otherReq = req("/api/admin/mfa", undefined, otherCookie), otherSetup = await mfa.beginMfa(await asUser(otherCookie), otherReq, "other-safe-password");
    await mfa.confirmMfa(await asUser(otherCookie), otherReq, otherSetup.id, mfa.totp(otherSetup.secret));
    const roleRace = await Promise.allSettled([
      accounts.changeManagedUser(await asUser(first), { id: other.id, version: 2, action: "role", role: "none", reason: "Concurrent removal by synthetic first administrator" }),
      accounts.changeManagedUser(await asUser(otherCookie), { id: root.id, version: 0, action: "role", role: "none", reason: "Concurrent removal by synthetic second administrator" }),
    ]);
    assert.equal(roleRace.filter(r => r.status === "fulfilled").length, 1, "Concurrent administrators cannot remove every root administrator");
    console.log(
      `Admin security, MFA replay, per-device revocation, role lifecycle and private support checks passed (${replica ? "MongoDB" : "SQLite"}).`,
    );
  } finally {
    if (replica) {
      const { mongo } = await import("../lib/storage/mongo");
      await (await mongo()).client.close();
      await replica.stop();
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
