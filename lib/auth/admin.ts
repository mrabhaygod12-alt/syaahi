import type { Account } from "./server";

/** No default administrator: production must explicitly configure ADMIN_EMAILS. */
export function isAdmin(user: Account | null): boolean {
  if (!user) return false;
  const emails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return emails.includes(user.email.toLowerCase());
}
