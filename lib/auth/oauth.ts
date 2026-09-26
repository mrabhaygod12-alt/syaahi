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
export function getSupabaseConfig(): { url: string; key: string | undefined } {
  let url =
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_URI ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URI;

  let key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY;

  // Never infer credentials from unrelated environment variables or use service-role secrets for OAuth.
  if (key?.startsWith("sb_secret_")) key = undefined;
  if (key?.startsWith("ey")) {
    try {
      if (
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
          .role === "service_role"
      )
        key = undefined;
    } catch {
      key = undefined;
    }
  }
  return { url: (url || "").replace(/\/+$/, ""), key };
}

export function oauthClient(req: NextRequest, response: NextResponse) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    throw new Error(
      `Google sign-in is not configured yet. Missing: ${!url ? "SUPABASE_URL " : ""}${!key ? "SUPABASE_PUBLISHABLE_KEY" : ""}. Please add these in your environment variables.`,
    );
  }
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
  const isGoogle =
    (identity.app_metadata?.providers as string[] | undefined)?.includes(
      "google",
    ) ||
    identity.app_metadata?.provider === "google" ||
    (typeof identity.user_metadata?.iss === "string" &&
      identity.user_metadata.iss.includes("google"));

  const isConfirmed =
    Boolean(identity.email_confirmed_at) ||
    Boolean(identity.user_metadata?.email_verified) ||
    Boolean(identity.user_metadata?.verified_email);

  if (!identity.email || !isConfirmed || !isGoogle) {
    throw new Error("A verified Google identity is required.");
  }

  const email = identity.email.trim().toLowerCase();

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
    const existing = await (await collection("users")).findOne({ email });
    if (existing) {
      // Securely link verified Google OAuth identity to existing account
      await (
        await collection("oauth_identities")
      ).updateOne(
        { _id: identity.id },
        { $set: { user: existing._id } },
        { upsert: true },
      );
      await (
        await collection("users")
      ).updateOne(
        { _id: existing._id },
        { $set: { verified: true, verifiedAt: new Date().toISOString() } },
      );
      return {
        id: existing._id,
        email: existing.email,
        name: existing.name,
        createdAt: existing.createdAt,
      };
    }
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
  if (process.env.APP_ROLE === "frontend" || process.env.NETLIFY === "true") {
    throw new Error(
      "Frontend database is not configured. Configure BACKEND_URL on Netlify or set MONGODB_URI.",
    );
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
  const existingLocal = db()
    .prepare("SELECT * FROM users WHERE email=?")
    .get(email) as any;
  if (existingLocal) {
    db()
      .prepare(
        "INSERT INTO oauth_identities VALUES (?,?) ON CONFLICT(subject) DO UPDATE SET user_id=excluded.user_id",
      )
      .run(identity.id, existingLocal.id);
    return {
      id: String(existingLocal.id),
      email: String(existingLocal.email),
      name: String(existingLocal.name),
      createdAt: String(existingLocal.created_at),
    };
  }
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
