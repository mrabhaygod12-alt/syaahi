import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
const origin = "https://www.syaahii.in";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-mfa-lifecycle-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  APP_ORIGIN: origin,
  NEXT_PUBLIC_APP_URL: origin,
  ADMIN_MFA_ENFORCE: "1",
  ADMIN_MFA_KEY: Buffer.alloc(32, 9).toString("base64"),
  ADMIN_EMAILS: "factor@example.test,validation@example.test",
  WORKER_MODE: "external",
});
async function main() {
  let replica: any;
  if (process.argv.includes("--mongo")) {
    replica = await (
      await import("mongodb-memory-server")
    ).MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replica.getUri();
    process.env.DATA_BACKEND = "mongo";
  }
  try {
    const auth = await import("../lib/auth/server"),
      mfa = await import("../lib/auth/admin-mfa"),
      state = await import("../lib/study/state"),
      sessions = await import("../lib/auth/session-security"),
      { adminScopes } = await import("../lib/auth/admin"),
      { markEmailVerified } = await import("../lib/billing/rewards"),
      { recentAudit } = await import("../lib/admin/audit"),
      api = await import("../app/api/admin/mfa/route"),
      access = await import("../app/api/admin/access/route"),
      { db } = await import("../lib/db"),
      { mongo } = await import("../lib/storage/mongo");
    const password = "fixture-factor-password",
      root = await auth.register(
        "Factor administrator",
        "factor@example.test",
        password,
      ),
      validator = await auth.register(
        "Validation administrator",
        "validation@example.test",
        password,
      ),
      learner = await auth.register(
        "Learner",
        "learner@example.test",
        password,
      );
    for (const u of [root, validator, learner]) await markEmailVerified(u.id);
    const cookie = async (
      u: typeof root,
      method: "password" | "oauth" = "password",
    ) =>
      (await auth.startSession(u, new Request(origin), {}, method)).headers
        .get("set-cookie")!
        .split(";")[0];
    const first = await cookie(root),
      second = await cookie(root),
      validation = await cookie(validator),
      student = await cookie(learner);
    const request = (body?: unknown, c = first, path = "/api/admin/mfa") =>
      new NextRequest(origin + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { origin, cookie: c, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const user = async (c = first) =>
      (await auth.currentUser(request(undefined, c)))!;
    const factor = () => state.readState<any>(root.id, "admin-mfa", {});
    const device = (c: string) =>
      sessions.deviceSession(
        sessions.sessionKey(request(undefined, c))!,
        root.id,
      );
    assert.equal(
      (
        await api.POST(
          request(
            { action: "rotate-recovery", password, code: "123456" },
            student,
          ),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await api.POST(
          request({ action: "replace", password, code: "123456" }, ""),
        )
      ).status,
      403,
    );
    for (const invalid of [
      null,
      [],
      "invalid",
      { action: "verify", code: ["123456"] },
    ])
      assert.equal((await api.POST(request(invalid, validation))).status, 400);
    const setup = await mfa.beginMfa(await user(), request(), password);
    const oldCodes = await mfa.confirmMfa(
      await user(),
      request(),
      setup.id,
      mfa.totp(setup.secret),
    );
    await mfa.challengeMfa(
      await user(second),
      request(undefined, second),
      oldCodes[0],
    );
    assert.equal(adminScopes(await user(second)).users, true);
    assert.equal(
      (
        await (
          await access.GET(request(undefined, first, "/api/admin/access"))
        ).json()
      ).owner,
      root.id,
    );
    const before = await factor();
    await assert.rejects(
      () =>
        mfa.rotateMfaRecovery(root, request(), "wrong-password", oldCodes[1]),
      /Confirm your password/,
    );
    await assert.rejects(
      () => mfa.rotateMfaRecovery(root, request(), password, oldCodes[0]),
      /already used/,
    );
    await assert.rejects(
      () =>
        mfa.rotateMfaRecovery(
          root,
          request(),
          password,
          mfa.totp(setup.secret),
        ),
      /already used/,
    );
    assert.deepEqual(
      await factor(),
      before,
      "Fresh proof failures cannot change recovery state",
    );

    async function auditOutage(work: () => Promise<void>) {
      if (replica) {
        const d = (await mongo()).database;
        await d.command({
          collMod: "admin_audit",
          validator: { _id: { $exists: false } },
          validationLevel: "strict",
        });
        try {
          await work();
        } finally {
          await d.command({ collMod: "admin_audit", validator: {} });
        }
      } else {
        db().exec(
          "CREATE TRIGGER reject_factor_audit BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'Synthetic private audit diagnostic'); END",
        );
        try {
          await work();
        } finally {
          db().exec("DROP TRIGGER reject_factor_audit");
        }
      }
    }
    const safeFailure = async (response: Response) => {
      assert.equal(response.status, 503);
      const data = await response.json();
      assert.match(data.requestId, /^[a-f0-9-]{36}$/);
      assert.equal(response.headers.get("x-request-id"), data.requestId);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.doesNotMatch(
        JSON.stringify(data),
        /diagnostic|validation failed|Mongo|SQLite|cipher|decrypt/i,
      );
    };
    const encryption = process.env.ADMIN_MFA_KEY;
    process.env.ADMIN_MFA_KEY = Buffer.alloc(1).toString("base64");
    try {
      await safeFailure(
        await api.POST(request({ action: "begin", password }, validation)),
      );
      assert.deepEqual(
        await state.readState(validator.id, "admin-mfa", {}),
        {},
      );
    } finally {
      process.env.ADMIN_MFA_KEY = encryption;
    }
    const firstDevice = await device(first),
      secondDevice = await device(second),
      auditBefore = (await recentAudit()).length;
    await auditOutage(async () => {
      await safeFailure(
        await api.POST(
          request({ action: "rotate-recovery", password, code: oldCodes[1] }),
        ),
      );
      assert.deepEqual(await factor(), before);
      assert.deepEqual(await device(first), firstDevice);
      assert.deepEqual(await device(second), secondDevice);
      assert.equal(
        (await recentAudit()).length,
        auditBefore,
        "Audit failure rolls back factor and session elevation together",
      );
    });
    const rotated = await api.POST(
      request({ action: "rotate-recovery", password, code: oldCodes[1] }),
    );
    assert.equal(rotated.status, 200);
    let codes: string[] = (await rotated.json()).recoveryCodes;
    assert.equal(codes.length, 8);
    assert.equal(new Set(codes).size, 8);
    assert.equal(adminScopes(await user()).users, true);
    assert.equal(
      adminScopes(await user(second)).users,
      false,
      "Recovery rotation expires other session elevations",
    );
    for (const old of oldCodes)
      await assert.rejects(
        () => mfa.challengeMfa(root, request(), old),
        /already used/,
      );
    assert(
      !JSON.stringify(await factor()).includes(codes[0]),
      "Only code hashes are stored",
    );
    const concurrent = await Promise.allSettled([
      mfa.rotateMfaRecovery(root, request(), password, codes[0]),
      mfa.rotateMfaRecovery(root, request(), password, codes[0]),
    ]);
    assert.equal(
      concurrent.filter((r) => r.status === "fulfilled").length,
      1,
      "One fresh factor can authorize only one concurrent rotation",
    );
    codes = (
      concurrent.find(
        (r) => r.status === "fulfilled",
      ) as PromiseFulfilledResult<string[]>
    ).value;

    const priorReplacement = await factor();
    await auditOutage(async () => {
      await safeFailure(
        await api.POST(
          request({ action: "replace", password, code: codes[0] }),
        ),
      );
      assert.deepEqual(
        await factor(),
        priorReplacement,
        "Failed replacement leaves old factor and recovery code intact",
      );
    });
    const replacementResponse = await api.POST(
      request({ action: "replace", password, code: codes[0] }),
    );
    assert.equal(replacementResponse.status, 200);
    const replacement = await replacementResponse.json();
    assert.equal(replacement.replacing, true);
    assert.equal(
      (await factor()).secret,
      priorReplacement.secret,
      "Old authenticator remains active during setup",
    );
    assert(!JSON.stringify(await factor()).includes(replacement.secret));
    await mfa.challengeMfa(root, request(undefined, second), codes[1]);
    assert.equal(adminScopes(await user(second)).users, true);
    await assert.rejects(
      () =>
        mfa.confirmMfa(
          root,
          request(undefined, second),
          replacement.id,
          mfa.totp(replacement.secret),
        ),
      /Setup expired or changed/,
    );
    const beforeConfirm = await factor(),
      beforeConfirmDevice = await device(first);
    await auditOutage(async () => {
      await safeFailure(
        await api.POST(
          request({
            action: "confirm",
            id: replacement.id,
            code: mfa.totp(replacement.secret),
          }),
        ),
      );
      assert.deepEqual(
        await factor(),
        beforeConfirm,
        "Failed confirmation keeps the old factor and pending setup",
      );
      assert.deepEqual(await device(first), beforeConfirmDevice);
    });
    const confirmed = await api.POST(
      request({
        action: "confirm",
        id: replacement.id,
        code: mfa.totp(replacement.secret),
      }),
    );
    assert.equal(confirmed.status, 200);
    const newCodes: string[] = (await confirmed.json()).recoveryCodes;
    assert.equal(newCodes.length, 8);
    assert.notEqual((await factor()).enabledAt, beforeConfirm.enabledAt);
    assert.equal((await factor()).pending, undefined);
    assert.equal(adminScopes(await user()).users, true);
    assert.equal(
      adminScopes(await user(second)).users,
      false,
      "Replacement expires other administrator elevations",
    );
    for (const old of codes)
      await assert.rejects(
        () => mfa.challengeMfa(root, request(), old),
        /already used/,
      );
    // Use a different time step from enrollment so this checks the changed secret,
    // rather than merely rejecting the replayed original enrollment code.
    const counter = Math.floor(Date.now() / 30000) + 1;
    const oldOtp = mfa.totp(setup.secret, counter),
      newOtp = mfa.totp(replacement.secret, counter);
    if (oldOtp !== newOtp)
      await assert.rejects(
        () => mfa.challengeMfa(root, request(), oldOtp),
        /already used/,
      );
    await mfa.challengeMfa(root, request(), newOtp);
    await assert.rejects(
      () => mfa.confirmMfa(root, request(), replacement.id, newOtp),
      /Setup expired or changed/,
    );

    // Starting another setup supersedes the previous session-bound pending key.
    const pending = await mfa.beginMfaReplacement(
      root,
      request(),
      password,
      newCodes[0],
    );
    const superseding = await mfa.beginMfaReplacement(
      root,
      request(),
      password,
      newCodes[1],
    );
    await assert.rejects(
      () =>
        mfa.cancelMfaReplacement(
          root,
          request(undefined, second),
          superseding.id,
        ),
      /Setup expired or changed/,
    );
    await assert.rejects(
      () =>
        mfa.confirmMfa(root, request(), pending.id, mfa.totp(pending.secret)),
      /Setup expired or changed/,
    );
    await mfa.cancelMfaReplacement(root, request(), superseding.id);
    assert.equal((await factor()).pending, undefined);
    await assert.rejects(
      () =>
        mfa.confirmMfa(
          root,
          request(),
          superseding.id,
          mfa.totp(superseding.secret),
        ),
      /Setup expired or changed/,
    );
    const expiring = await mfa.beginMfaReplacement(
      root,
      request(),
      password,
      newCodes[2],
    );
    const savedPending = await factor();
    await state.mutateState(root.id, "admin-mfa", {}, () => ({
      ...savedPending,
      pending: { ...savedPending.pending, until: Date.now() - 1 },
    }));
    await assert.rejects(
      () =>
        mfa.confirmMfa(root, request(), expiring.id, mfa.totp(expiring.secret)),
      /Setup expired or changed/,
    );
    await mfa.challengeMfa(root, request(), newCodes[3]);
    const oauth = await cookie(root, "oauth");
    const oauthCodes = await mfa.rotateMfaRecovery(
      root,
      request(undefined, oauth),
      "",
      newCodes[4],
    );
    const oauthDevice = (await device(oauth))!,
      oauthState = await factor();
    for (const offset of [-6 * 60000, 60000]) {
      const changed = {
        ...oauthDevice,
        createdAt: new Date(Date.now() + offset).toISOString(),
      };
      if (replica)
        await (
          await mongo()
        ).database
          .collection<any>("sessions")
          .updateOne({ _id: oauthDevice.id }, { $set: { device: changed } });
      else
        db()
          .prepare("UPDATE session_devices SET payload=? WHERE id=?")
          .run(JSON.stringify(changed), oauthDevice.id);
      await assert.rejects(
        () =>
          mfa.rotateMfaRecovery(
            root,
            request(undefined, oauth),
            "",
            oauthCodes[0],
          ),
        /Confirm your password/,
      );
      assert.deepEqual(
        await factor(),
        oauthState,
        "Expired or future Google sessions do not satisfy fresh identity proof",
      );
    }
    const audit = JSON.stringify(await recentAudit());
    assert.match(audit, /mfa.recovery_rotated/);
    assert.match(audit, /mfa.replaced/);
    for (const secret of [
      setup.secret,
      replacement.secret,
      ...oldCodes,
      ...codes,
      ...newCodes,
      ...oauthCodes,
    ])
      assert(!audit.includes(secret));
    console.log(
      `PASS admin MFA lifecycle (${replica ? "MongoDB" : "SQLite"}): fresh proof, recovery rotation, safe replacement, old-code/session invalidation, concurrency, session-bound/expired setups, encrypted secrets, redacted service failures and atomic audit rollback.`,
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
