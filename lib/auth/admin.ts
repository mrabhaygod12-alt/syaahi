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

export function adminScopes(user: Account | null) {
  const includesId = (value: string | undefined) =>
    Boolean(
      user &&
      (value || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .includes(user.id),
    );
  return {
    editorial: isAdmin(user),
    payments: includesId(process.env.PAYMENT_ADMIN_IDS),
    support: includesId(process.env.SUPPORT_ADMIN_IDS),
  };
}
