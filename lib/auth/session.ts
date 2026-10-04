import { requestJson } from "@/lib/http-client";
// This cache is for header display only. The server authenticates every API call.
export interface DemoUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  avatar?: string | null;
  verified?: boolean;
  workspace?: "student" | "writer";
}
const KEY = "syaahi-user";
export function getUser(): DemoUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
export interface SignInResult {
  user?: DemoUser;
  requireVerification?: boolean;
  verifyUrl?: string;
  message?: string;
  error?: string;
}

export async function signIn(
  name: string,
  email: string,
  password: string,
  mode: "login" | "signup",
  acceptTerms = false,
  referralCode?: string | null,
  workspace?: "student" | "writer",
): Promise<SignInResult> {
  const { response, data } = await requestJson("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      email,
      password,
      mode,
      acceptTerms,
      referralCode,
      workspace,
      termsVersion: "2026-10-03",
    }),
  });
  if (!response.ok) {
    const err = new Error(data.error || "Sign-in failed.") as Error & {
      requireVerification?: boolean;
      verifyUrl?: string;
    };
    err.requireVerification = data.requireVerification;
    err.verifyUrl = data.verifyUrl;
    throw err;
  }
  if (data.user && !data.requireVerification) {
    localStorage.setItem(KEY, JSON.stringify(data.user));
  }
  return data;
}
export async function refreshUser(): Promise<DemoUser | null> {
  const { response, data } = await requestJson("/api/auth");
  if (!response.ok)
    throw new Error(data.error || "Could not check your session.");
  const { user } = data;
  if (user) localStorage.setItem(KEY, JSON.stringify(user));
  else localStorage.removeItem(KEY);
  return user;
}
export async function signOut() {
  const { response, data } = await requestJson("/api/auth", {
    method: "DELETE",
  });
  if (!response.ok)
    throw new Error(data.error || "Could not sign out. Please retry.");
  localStorage.removeItem(KEY);
}
