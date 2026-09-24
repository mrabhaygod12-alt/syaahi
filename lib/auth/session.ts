// This cache is for header display only. The server authenticates every API call.
export interface DemoUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
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
export async function signIn(
  name: string,
  email: string,
  password: string,
  mode: "login" | "signup",
  acceptTerms=false,
): Promise<DemoUser> {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, mode,acceptTerms,termsVersion:"2026-09-24" }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Sign-in failed.");
  localStorage.setItem(KEY, JSON.stringify(data.user));
  return data.user;
}
export async function refreshUser(): Promise<DemoUser | null> {
  const response = await fetch("/api/auth");
  const { user } = await response.json();
  if (user) localStorage.setItem(KEY, JSON.stringify(user));
  else localStorage.removeItem(KEY);
  return user;
}
export async function signOut() {
  await fetch("/api/auth", { method: "DELETE" });
  localStorage.removeItem(KEY);
}
