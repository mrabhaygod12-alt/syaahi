import { SIGNUP_CREDITS } from "@/lib/billing/allowance";
import { useMongo, collection, mongoTransaction } from "@/lib/storage/mongo";
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { NextResponse } from "next/server";
import { db, transaction } from "@/lib/db";
export interface Account {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  avatar?: string | null;
  verified?: boolean;
  locale?: string | null;
  workspace?: "student" | "writer";
  /** Server-only, non-enumerable authorization context; never accepted from clients. */
  adminRole?: import("./session-security").AdminRole | null;
  sessionId?: string;
  adminMfaEnrolled?: boolean;
  adminAuthenticated?: boolean;
  legacyPaymentAdmin?: boolean;
}
export class AccountAccessError extends Error {}
export async function assertAccountActive(id: string) {
  const { DEFAULT_CONTROL } = await import("./session-security");
  const { readState } = await import("@/lib/study/state");
  if (
    (await readState(id, "account-control", DEFAULT_CONTROL)).status !==
    "active"
  )
    throw new AccountAccessError(
      "This account is unavailable. Contact support.",
    );
}
const COOKIE = "syaahi-session";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function passwordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password: string, saved: string): boolean {
  const [salt, key] = saved.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function currentUser(req: Request): Promise<Account | null> {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!token || token.length > 128) return null;
  if (useMongo()) {
    const session = await (
      await collection("sessions")
    ).findOne({ _id: hash(token), expiresAt: { $gt: new Date() } });
    if (!session) return null;
    const user = await (
      await collection("users")
    ).findOne({ _id: session.user });
    if (!user) return null;
    const isVerified =
      Boolean(user.verified) ||
      Boolean(user.verifiedAt) ||
      Boolean(
        await (
          await collection("verified_accounts")
        ).findOne({ _id: user._id }),
      );
    // Never let an old or pre-verification session authorize a password account.
    if (!isVerified) {
      await (await collection("sessions")).deleteOne({ _id: hash(token) });
      return null;
    }
    return (await import("./session-security")).secureAccount(
      {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        avatar: user.avatar || null,
        verified: true,
        locale: typeof user.locale === "string" ? user.locale : null,
        workspace: user.workspace === "writer" ? "writer" : "student",
      },
      token,
    );
  }
  const row = db()
    .prepare(
      `SELECT u.id,u.email,u.name,u.created_at,u.locale,u.workspace,u.avatar FROM sessions s
    JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?`,
    )
    .get(hash(token), Date.now());
  if (row) {
    const { rewardSummary } = await import("@/lib/billing/rewards");
    if (!(await rewardSummary(String(row.id))).emailVerified) {
      db().prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(token));
      return null;
    }
  }
  return row
    ? (await import("./session-security")).secureAccount(
        {
          id: String(row.id),
          email: String(row.email),
          name: String(row.name),
          createdAt: String(row.created_at),
          avatar: typeof row.avatar === "string" ? row.avatar : null,
          verified: true,
          locale: typeof row.locale === "string" ? row.locale : null,
          workspace: row.workspace === "writer" ? "writer" : "student",
        },
        token,
      )
    : null;
}
export function originError(req: Request): NextResponse | null {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return null;
  if (req.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  const origin = req.headers.get("origin");
  if (!origin) return null;

  // The proxy authenticates infrastructure, not the browser Origin.
  // Keep CSRF checks when Vercel forwards the request to Render.
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const allowed = new Set(
    [
      new URL(req.url).origin,
      (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, ""),
      "https://syaahii.in",
      "https://www.syaahii.in",
      ...(process.env.NODE_ENV !== "production"
        ? ["http://localhost:3000", "http://127.0.0.1:3000"]
        : []),
    ].filter(Boolean),
  );

  if (!allowed.has(normalizedOrigin)) {
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  }
  return null;
}
export async function authError(req: Request): Promise<NextResponse | null> {
  return (
    originError(req) ||
    ((await currentUser(req))
      ? null
      : NextResponse.json(
          { error: "Please sign in to continue." },
          { status: 401 },
        ))
  );
}
export async function register(
  name: string,
  email: string,
  password: string,
  oauthSubject?: string,
): Promise<Account> {
  const user = {
    id: randomUUID(),
    name,
    email,
    createdAt: new Date().toISOString(),
  };
  const encoded = passwordHash(password);
  if (useMongo()) {
    const doc = { _id: user.id, ...user, password: encoded };
    try {
      await mongoTransaction(async (d, session) => {
        await d.collection<any>("users").insertOne(doc, { session });
        if (oauthSubject)
          await d
            .collection<any>("oauth_identities")
            .insertOne({ _id: oauthSubject, user: user.id }, { session });
        await d
          .collection<any>("wallets")
          .insertOne({ _id: user.id, balance: SIGNUP_CREDITS }, { session });
        await d.collection<any>("ledger").insertOne(
          {
            _id: `welcome:${user.id}`,
            user: user.id,
            delta: SIGNUP_CREDITS,
            reason: "Welcome page units",
            createdAt: new Date(),
          },
          { session },
        );
      });
    } catch (txErr) {
      console.error(
        "Mongo account transaction failed",
        txErr instanceof Error ? txErr.name : "unknown",
      );
      throw new Error("Account creation could not be completed. Please retry.");
    }

    // Sync to Supabase Auth in background so user appears in Supabase dashboard
    import("./supabase-sync")
      .then((m) => m.syncUserToSupabase(email, password, name))
      .catch(() => {});

    return user;
  }
  if (process.env.APP_ROLE === "frontend" || process.env.VERCEL === "1") {
    throw new Error(
      "Frontend database is not configured. Configure BACKEND_URL on Vercel or set MONGODB_URI.",
    );
  }
  transaction(() => {
    db()
      .prepare(
        "INSERT INTO users (id,email,name,password,created_at) VALUES (?,?,?,?,?)",
      )
      .run(user.id, email, name, encoded, user.createdAt);
    if (oauthSubject)
      db()
        .prepare("INSERT INTO oauth_identities VALUES (?,?)")
        .run(oauthSubject, user.id);
    db()
      .prepare("INSERT INTO wallets VALUES (?,?)")
      .run(user.id, SIGNUP_CREDITS);
    db()
      .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
      .run(
        `welcome:${user.id}`,
        user.id,
        SIGNUP_CREDITS,
        "Welcome credits",
        user.createdAt,
      );
  });

  import("./supabase-sync")
    .then((m) => m.syncUserToSupabase(email, password, name))
    .catch(() => {});

  return user;
}
export async function startSession(
  user: Account,
  req: Request,
  extra: Record<string, unknown> = {},
  method: "password" | "oauth" = "password",
): Promise<NextResponse> {
  const { rememberSession } = await import("./session-security");
  await assertAccountActive(user.id);
  const token = randomBytes(32).toString("hex");
  if (useMongo())
    await (
      await collection("sessions")
    ).insertOne({
      _id: hash(token),
      user: user.id,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
  else {
    db().prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    db()
      .prepare("INSERT INTO sessions VALUES (?,?,?)")
      .run(hash(token), user.id, Date.now() + 7 * 86400000);
  }
  await rememberSession(hash(token), user.id, req, method);
  const response = NextResponse.json({ user, ...extra });
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" ||
      new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: 7 * 86400,
  });
  return response;
}
export async function endSession(req: Request): Promise<NextResponse> {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (token) {
    if (useMongo())
      await (await collection("sessions")).deleteOne({ _id: hash(token) });
    else
      db().prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(token));
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function accountByEmail(email: string) {
  if (typeof email !== "string") return null;
  const clean = email.trim().toLowerCase();
  if (!clean || clean.length > 254) return null;
  if (useMongo()) {
    const user = await (await collection("users")).findOne({ email: clean });
    return user
      ? {
          id: String(user._id),
          email: user.email,
          name: user.name,
          password: user.password,
          created_at: user.createdAt,
          workspace: user.workspace || "student",
        }
      : null;
  }
  return db().prepare("SELECT * FROM users WHERE email=?").get(clean);
}
