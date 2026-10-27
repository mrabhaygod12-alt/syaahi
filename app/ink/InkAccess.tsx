"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { requestJson } from "./client";
import { InkPaperArt } from "./InkUI";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
const InkSearchContext = createContext(false);
export const useInkSearch = () => useContext(InkSearchContext);
export default function InkAccess({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<
    "loading" | "ready" | "login" | "plan" | "error"
  >("loading");
  const [message, setMessage] = useState("");
  const [searchConfigured, setSearchConfigured] = useState(false);
  const pathname = usePathname();
  async function load() {
    setState("loading");
    try {
      const { data } = await requestJson<{
        entitled: boolean;
        searchConfigured?: boolean;
      }>("/api/ink?access=1");
      setState(data.entitled ? "ready" : "plan");
      setSearchConfigured(data.searchConfigured === true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not check access.",
      );
      setState(
        (error as { status?: number }).status === 401 ? "login" : "error",
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  if (pathname === "/ink/how-it-works") return <>{children}</>;
  if (state === "ready")
    return (
      <InkSearchContext.Provider value={searchConfigured}>
        {children}
      </InkSearchContext.Provider>
    );
  return (
    <main className="ink-page">
      <div className="ink-access-layout" aria-live="polite" data-ink-reveal>
        <div>
          <p className="ink-kicker">
            <ShieldCheck size={14} /> YOUR DOCUMENT STUDIO
          </p>
          <h1>
            {state === "loading"
              ? "Opening your desk…"
              : state === "login"
                ? "Your next draft starts here."
                : state === "plan"
                  ? "A little closer to your best work."
                  : "Let’s reconnect your desk."}
          </h1>
          <p>
            {state === "loading"
              ? "Checking your student access."
              : state === "plan"
                ? "Document checks and the rewrite desk are included with a purchased student pack or active paid subscription."
                : state === "login"
                  ? "Upload a document. Review the evidence. Make the next version clearer."
                  : message}
          </p>
          {state === "login" && (
            <Link
              className="ink-btn"
              href={`/login?next=${encodeURIComponent(pathname)}`}
            >
              Sign in <ArrowRight size={16} />
            </Link>
          )}
          {state === "plan" && (
            <Link className="ink-btn" href="/pricing">
              View student plans
            </Link>
          )}
          {state === "error" && (
            <button className="ink-btn" onClick={load}>
              Retry access check
            </button>
          )}
          <div className="ink-access-features">
            <span>
              <Check size={13} /> PDF and DOCX
            </span>
            <span>
              <Check size={13} /> Private reports
            </span>
            <span>
              <Check size={13} /> Guided editing
            </span>
          </div>
          {state === "plan" && (
            <p className="ink-small-print">
              Free signup credits don’t unlock AI Ink.
            </p>
          )}
          <p className="ink-note" style={{ marginTop: 24 }}>
            <Link href="/dashboard">Back to student workspace</Link>
          </p>
        </div>
        <div className="ink-access-art">
          <InkPaperArt scanning={state === "loading"} />
        </div>
      </div>
    </main>
  );
}
