import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./oauth";

/** Never accept a browser JWT or a claimed email as verification evidence. */
export async function hostedEmailConfirmed(email: string, password: string) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return false;
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        }),
    },
  });
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session?.access_token) return false;
    const verified = await client.auth.getUser(data.session.access_token);
    return (
      !verified.error &&
      !!verified.data.user?.email_confirmed_at &&
      verified.data.user.email?.trim().toLowerCase() ===
        email.trim().toLowerCase()
    );
  } catch {
    return false;
  } finally {
    await client.auth.signOut({ scope: "local" }).catch(() => {});
  }
}

export async function resendHostedVerification(email: string) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key || !process.env.NEXT_PUBLIC_APP_URL) return false;
  try {
    const client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.timeout(10000),
            redirect: "error",
          }),
      },
    });
    const { error } = await client.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: new URL("/login", process.env.NEXT_PUBLIC_APP_URL)
          .href,
      },
    });
    return !error;
  } catch {
    return false;
  }
}
