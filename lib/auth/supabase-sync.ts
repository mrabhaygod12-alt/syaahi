import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./oauth";

/**
 * Synchronizes user accounts into Supabase Auth so they appear in Supabase Dashboard.
 * Non-blocking: logs any upstream warnings without interrupting app registration.
 */
export async function syncUserToSupabase(
  email: string,
  password?: string,
  name?: string,
) {
  const { url, key } = getSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || (!key && !secretKey)) {
    return;
  }

  try {
    if (secretKey) {
      // Registration is not proof of email ownership.
      const adminClient = createClient(url, secretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await adminClient.auth.admin.createUser({
        email,
        password: password || undefined,
        email_confirm: false,
        user_metadata: { full_name: name || email.split("@")[0] },
      });
      if (
        error &&
        !error.message.includes("already registered") &&
        !error.message.includes("already exists")
      ) {
        console.warn("Supabase admin sync warning:", error.name);
      }
    } else if (key && password) {
      // Use Public client to sign up user in Supabase
      const pubClient = createClient(url, key);
      const { error } = await pubClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: name || email.split("@")[0] } },
      });
      if (
        error &&
        !error.message.includes("already registered") &&
        !error.message.includes("already exists")
      ) {
        console.warn("Supabase public sync warning:", error.name);
      }
    }
  } catch (err) {
    console.warn(
      "Supabase sync exception:",
      err instanceof Error ? err.name : "unknown",
    );
  }
}
