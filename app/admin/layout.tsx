import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import {
  adminScopes,
  adminEligibility,
  adminRouteScope,
} from "@/lib/auth/admin";
import AdminShell from "@/components/admin/AdminShell";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookie = (await cookies()).toString();
  const path = (await headers()).get("x-syaahi-pathname");
  const scope = adminRouteScope(path);
  if (!cookie) redirect("/login?next=/admin");
  const frontend =
    process.env.APP_ROLE === "frontend" || process.env.VERCEL === "1";
  if (frontend) {
    const secret = process.env.BACKEND_PROXY_SECRET;
    let allowed = false;
    let requiresMfa = false;
    try {
      const url = new URL("/api/admin/access", process.env.BACKEND_URL);
      if (url.protocol !== "https:" || url.username || url.password || !secret)
        notFound();
      const response = await fetch(url, {
        headers: { cookie, "x-syaahi-proxy": secret! },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const access = await response.json();
        allowed =
          access.eligible === true &&
          (!scope || access.eligibility?.[scope] === true);
        requiresMfa = access.requiresMfa === true;
      }
    } catch {
      /* Fail closed during an outage. */
    }
    if (!allowed) notFound();
    if (requiresMfa && path !== "/admin/security") redirect("/admin/security");
  } else {
    const user = await currentUser(
      new Request("https://www.syaahii.in/admin", { headers: { cookie } }),
    );
    if (!user) redirect("/login?next=/admin");
    if (!Object.values(adminEligibility(user)).some(Boolean)) notFound();
    if (scope && !adminEligibility(user)[scope]) notFound();
    if (
      !Object.values(adminScopes(user)).some(Boolean) &&
      path !== "/admin/security"
    )
      redirect("/admin/security");
  }
  return <AdminShell>{children}</AdminShell>;
}
