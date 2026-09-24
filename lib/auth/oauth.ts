import { useMongo, collection } from "@/lib/storage/mongo";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { register, type Account } from "./server";
export const safeNext = (value: string | null) =>
  value && /^\/(?![\/\\])/.test(value) && !/[\r\n\\]/.test(value)
    ? value
    : "/dashboard";
export function oauthClient(req: NextRequest, response: NextResponse) {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Google sign-in is not configured yet. Email sign-in is available.",
    );
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      secure: new URL(req.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        ),
    },
  });
}
export async function googleAccount(identity: {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): Promise<Account> {
  if (
    !identity.email ||
    !identity.email_confirmed_at ||
    !(identity.app_metadata?.providers as string[] | undefined)?.includes(
      "google",
    )
  )
    throw new Error("A verified Google identity is required.");
  if (useMongo()) {
    const map = await (
      await collection("oauth_identities")
    ).findOne({ _id: identity.id });
    if (map) {
      const u = await (await collection("users")).findOne({ _id: map.user });
      if (u)
        return {
          id: u._id,
          email: u.email,
          name: u.name,
          createdAt: u.createdAt,
        };
    }
    const email = identity.email.trim().toLowerCase();
    if (await (await collection("users")).findOne({ email }))
      throw new Error(
        "This email already has an account. Use the original sign-in method.",
      );
    const user = await register(
      String(identity.user_metadata?.full_name || email.split("@")[0]).slice(
        0,
        80,
      ),
      email,
      randomBytes(48).toString("hex"),
      identity.id,
    );
    return user;
  }
  db().exec(
    "CREATE TABLE IF NOT EXISTS oauth_identities (subject TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id))",
  );
  const mapped = db()
    .prepare(
      "SELECT u.* FROM oauth_identities o JOIN users u ON u.id=o.user_id WHERE o.subject=?",
    )
    .get(identity.id);
  if (mapped)
    return {
      id: String(mapped.id),
      email: String(mapped.email),
      name: String(mapped.name),
      createdAt: String(mapped.created_at),
    };
  const email = identity.email.trim().toLowerCase();
  if (db().prepare("SELECT id FROM users WHERE email=?").get(email))
    throw new Error(
      "This email already has a password account. Sign in with your password; automatic account linking is disabled.",
    );
  const user = await register(
    String(identity.user_metadata?.full_name || email.split("@")[0]).slice(
      0,
      80,
    ),
    email,
    randomBytes(48).toString("hex"),
    identity.id,
  );
  return user;
}
