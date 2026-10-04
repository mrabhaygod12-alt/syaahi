"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { requestJson } from "@/lib/http-client";
import { workspaceDestination, studentPath } from "@/lib/workspace-routing";
import type { DemoUser } from "@/lib/auth/session";
const Context = createContext<{
  user: DemoUser | null;
  loading: boolean;
  error: string;
  refresh: () => void;
}>({ user: null, loading: true, error: "", refresh: () => {} });
export const useAccount = () => useContext(Context);
export default function WorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<DemoUser | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const path = usePathname() || "/";
  const refresh = () => {
    setError("");
    setLoading(true);
    requestJson("/api/auth")
      .then(({ response, data }) => {
        if (!response.ok)
          throw new Error(data.error || "Your account could not be loaded.");
        setUser(data.user || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    refresh();
    const sync = () => refresh();
    window.addEventListener("syaahi:account-updated", sync);
    return () => window.removeEventListener("syaahi:account-updated", sync);
  }, []);
  const legacy =
    studentPath(path) ||
    /^\/(pricing|support|profile|account\/billing|subscribe|payments|pay)(\/|$)/.test(
      path,
    );
  const destination =
    user?.workspace === "writer" ? workspaceDestination(path, "writer") : path;
  useEffect(() => {
    if (!loading && !error && destination !== path)
      location.replace(
        workspaceDestination(
          location.pathname + location.search + location.hash,
          "writer",
        ),
      );
  }, [loading, error, destination, path]);
  return (
    <Context.Provider value={{ user, loading, error, refresh }}>
      {legacy && (loading || error || destination !== path) ? (
        <section className="account-route-gate">
          <p role={error ? "alert" : "status"}>
            {error || "Opening your workspace…"}
          </p>
          {error && (
            <button className="btn light" onClick={refresh}>
              Try again
            </button>
          )}
        </section>
      ) : (
        children
      )}
    </Context.Provider>
  );
}
