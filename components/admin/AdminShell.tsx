"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { requestJson } from "@/lib/http-client";
import "./admin.css";
export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname(),
    [access, setAccess] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setAccess(null);
    setError("");
    requestJson("/api/admin/access", { signal: controller.signal })
      .then(({ response, data }) => {
        if (controller.signal.aborted) return;
        if (!response.ok || !data.eligible)
          throw new Error(data.error || "Administrator access unavailable.");
        setAccess(data);
        if (data.requiresMfa && path !== "/admin/security")
          location.replace("/admin/security");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [path]);
  if (error)
    return (
      <main className="wrap feature-section">
        <h1>Administrator access</h1>
        <p role="alert">{error}</p>
        <a href="/login?next=/admin">Sign in again</a>
      </main>
    );
  if (!access)
    return (
      <main className="wrap feature-section" aria-busy="true">
        <p role="status">Checking administrator access…</p>
      </main>
    );
  const links = [
    ["Overview", "/admin", true],
    ["Users", "/admin/users", access.scopes.users],
    ["Editorial", "/admin/publications", access.scopes.editorial],
    ["Payments", "/admin/payments", access.scopes.payments],
    ["Support", "/admin/support", access.scopes.support],
    ["Growth", "/admin/growth", access.scopes.editorial],
    ["Security", "/admin/security", true],
  ];
  return (
    <div className="admin-space">
      <nav className="admin-nav" aria-label="Administration">
        <a href="/admin" className="admin-brand">
          Syaahi <span>Control room</span>
        </a>
        <div>
          {links
            .filter((l) => l[2])
            .map(([name, href]) => (
              <a
                key={String(href)}
                href={String(href)}
                aria-current={path === href ? "page" : undefined}
              >
                {name}
              </a>
            ))}
        </div>
      </nav>
      {!access.requiresMfa || path === "/admin/security" ? (
        children
      ) : (
        <p role="status">Verify your authenticator to continue.</p>
      )}
    </div>
  );
}
