"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { requestJson } from "./client";
export default function InkAccess({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "login" | "plan" | "error">("loading");
  const [message, setMessage] = useState("");
  const pathname = usePathname();
  async function load() {
    setState("loading");
    try {
      const { data } = await requestJson<{ entitled: boolean }>("/api/ink?access=1");
      setState(data.entitled ? "ready" : "plan");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check access.");
      setState((error as { status?: number }).status === 401 ? "login" : "error");
    }
  }
  useEffect(() => { void load(); }, []);
  if (pathname === "/ink/how-it-works") return <>{children}</>;
  if (state === "ready") return <>{children}</>;
  return <main className="ink-page"><div className="ink-panel" aria-live="polite">
    <p className="ink-kicker">AI Ink · Student workspace</p>
    <h1 className="ink-h2">{state === "loading" ? "Opening your proofing desk…" : state === "login" ? "Your writing stays with your account." : state === "plan" ? "A clearer draft starts here." : "We could not open your desk."}</h1>
    <p className="ink-note">{state === "loading" ? "Checking your session and student plan." : state === "plan" ? "Source-overlap reports, citation checks and the rewrite desk are included with a purchased student pack or an active paid student subscription. Free signup credits do not unlock AI Ink." : message}</p>
    {state === "login" && <Link className="ink-btn" href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>}
    {state === "plan" && <Link className="ink-btn" href="/pricing">View student plans</Link>}
    {state === "error" && <button className="ink-btn" onClick={load}>Retry access check</button>}
    <p className="ink-note" style={{ marginTop: 24 }}><Link href="/dashboard">Back to student workspace</Link></p>
  </div></main>;
}
