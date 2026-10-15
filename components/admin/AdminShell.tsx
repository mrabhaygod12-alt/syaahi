"use client";
import { startTransition, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { requestJson, ServiceRequestError } from "@/lib/http-client";
import { useAccount } from "@/components/WorkspaceProvider";
import {
  Menu,
  Search,
  LayoutDashboard,
  Users,
  PenLine,
  CreditCard,
  LifeBuoy,
  ChartNoAxesCombined,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import "./admin.css";
export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false),
    [filter, setFilter] = useState("");
  const path = usePathname(),
    account = useAccount(),
    [access, setAccess] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setAccess(null);
    setError("");
    if (account.loading) return;
    if (!account.user || account.error) {
      setError(account.error || "Please sign in to continue.");
      return;
    }
    const owner = account.user.id;
    requestJson("/api/admin/access", { signal: controller.signal })
      .then(({ response, data }) => {
        if (controller.signal.aborted) return;
        if (!response.ok || !data.eligible)
          throw new ServiceRequestError(
            data.error || "Administrator access unavailable.",
            response.status,
            data.requestId,
          );
        if (data.owner !== owner)
          throw new Error(
            "Your administrator account could not be verified. Sign in again.",
          );
        startTransition(() => setAccess(data));
        if (data.requiresMfa && path !== "/admin/security")
          location.replace("/admin/security");
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          startTransition(() => setError(e.message));
      });
    return () => controller.abort();
  }, [path, account.loading, account.user?.id, account.error]);
  if (account.loading || (access && access.owner !== account.user?.id))
    return (
      <main className="wrap feature-section" aria-busy="true">
        <p role="status">Checking administrator access…</p>
      </main>
    );
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
    ["Reviews", "/admin/reviews", access.scopes.editorial],
    ["Security", "/admin/security", true],
  ];
  const icons = [
    LayoutDashboard,
    Users,
    PenLine,
    CreditCard,
    LifeBuoy,
    ChartNoAxesCombined,
    MessageSquare,
    ShieldCheck,
  ];
  return (
    <div
      className={`admin-space ${navOpen ? "admin-nav-open" : ""}`}
      key={access.owner}
    >
      <header className="admin-topbar">
        <a href="/admin" className="admin-brand">
          Syaahii<span>Control room</span>
        </a>
        <button
          type="button"
          aria-label={
            navOpen
              ? "Close administration navigation"
              : "Open administration navigation"
          }
          aria-expanded={navOpen}
          onClick={() => setNavOpen(!navOpen)}
        >
          <Menu size={22} />
        </button>
        <label className="admin-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Find administration page"
            placeholder="Find a control…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setNavOpen(true);
            }}
          />
        </label>
        <a className="admin-account" href="/admin/security">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            {account.user?.name}
            <small>Protected administration</small>
          </span>
        </a>
      </header>
      {navOpen && (
        <button
          className="admin-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}
      <nav className="admin-nav" aria-label="Administration">
        <p className="admin-nav-label">PLATFORM</p>
        <div>
          {links
            .map(([name, href, enabled], index) => ({
              name: String(name),
              href: String(href),
              enabled,
              Icon: icons[index],
            }))
            .filter(
              (l) =>
                l.enabled &&
                l.name.toLowerCase().includes(filter.toLowerCase()),
            )
            .map(({ name, href, Icon }) => (
              <a
                key={href}
                href={href}
                aria-current={path === href ? "page" : undefined}
                onClick={() => setNavOpen(false)}
              >
                <Icon size={19} aria-hidden="true" />
                {name}
              </a>
            ))}
        </div>
        <div className="admin-nav-bottom">
          <p>Every change has an owner.</p>
          <a href="/dashboard">Return to workspace</a>
        </div>
      </nav>
      <div className="admin-workbench">
        <div className="admin-breadcrumb">
          <span>Administration</span>
          <span>/</span>
          <b>{links.find((l) => l[1] === path)?.[0] || "Control room"}</b>
        </div>
        {!access.requiresMfa || path === "/admin/security" ? (
          children
        ) : (
          <p role="status">Verify your authenticator to continue.</p>
        )}
      </div>
    </div>
  );
}
