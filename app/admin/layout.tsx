import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { adminScopes } from "@/lib/auth/admin";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookie = (await cookies()).toString();
  if (!cookie) redirect("/login?next=/admin/publications");
  const frontend =
    process.env.APP_ROLE === "frontend" || process.env.VERCEL === "1";
  if (frontend) {
    const secret = process.env.BACKEND_PROXY_SECRET;
    let allowed = false;
    try {
      const url = new URL("/api/admin/access", process.env.BACKEND_URL);
      if (url.protocol !== "https:" || url.username || url.password || !secret)
        notFound();
      const response = await fetch(url, {
        headers: { cookie, "x-syaahi-proxy": secret! },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      allowed = response.ok;
    } catch {
      /* Fail closed during an outage. */
    }
    if (!allowed) notFound();
  } else {
    const user = await currentUser(
      new Request("https://www.syaahii.in/admin", { headers: { cookie } }),
    );
    if (!user) redirect("/login?next=/admin/publications");
    if (!Object.values(adminScopes(user)).some(Boolean)) notFound();
  }
  return children;
}
