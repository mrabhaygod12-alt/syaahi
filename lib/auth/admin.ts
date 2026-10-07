import type { Account } from "./server";

/** No default administrator: production must explicitly configure ADMIN_EMAILS. */
function configuredEditorial(user: Account | null): boolean {
  if (!user) return false;
  const emails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return emails.includes(user.email.toLowerCase());
}

export function adminEligibility(user: Account | null) {
  const includesId = (value: string | undefined) =>
    Boolean(
      user &&
      (value || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .includes(user.id),
    );
  const role = user?.adminRole;
  const bootstrap = role === undefined || role === null;
  const root = role === "admin" || (bootstrap && configuredEditorial(user));
  return {
    users: root,
    editorial: root || role === "editor",
    payments:
      root ||
      role === "billing" ||
      (bootstrap &&
        (includesId(process.env.PAYMENT_ADMIN_IDS) ||
          user?.legacyPaymentAdmin === true)),
    support:
      root ||
      role === "support" ||
      (bootstrap && includesId(process.env.SUPPORT_ADMIN_IDS)),
  };
}
export function adminScopes(user: Account | null) {
  const scopes = adminEligibility(user);
  const required =
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_MFA_ENFORCE === "1" ||
    user?.adminMfaEnrolled;
  return Object.fromEntries(
    Object.entries(scopes).map(([key, value]) => [
      key,
      value && (!required || user?.adminAuthenticated === true),
    ]),
  ) as typeof scopes;
}
export function isAdmin(user: Account | null): boolean {
  return adminScopes(user).editorial;
}
export function adminRouteScope(
  path: string | null,
): keyof ReturnType<typeof adminScopes> | null {
  if (path?.startsWith("/admin/users")) return "users";
  if (path?.startsWith("/admin/payments")) return "payments";
  if (path?.startsWith("/admin/support")) return "support";
  if (path && /^\/admin\/(publications|campus|growth)(\/|$)/.test(path))
    return "editorial";
  return null;
}
