"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { requestJson } from "@/lib/http-client";
import {
  workspaceDestination,
  workspaceScopedPath,
} from "@/lib/workspace-routing";
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
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError("");
    setLoading(true);
    requestJson("/api/auth", { signal: controller.signal })
      .then(({ response, data }) => {
        if (request.current !== controller || controller.signal.aborted) return;
        if (!response.ok)
          throw new Error(data.error || "Your account could not be loaded.");
        setUser(data.user || null);
      })
      .catch((e) => {
        if (request.current !== controller || controller.signal.aborted) return;
        setUser(null);
        setError(e.message);
      })
      .finally(() => {
        if (request.current === controller && !controller.signal.aborted)
          setLoading(false);
      });
  }, []);
  useEffect(() => {
    refresh();
    const sync = () => refresh();
    window.addEventListener("syaahi:account-updated", sync);
    return () => {
      request.current?.abort();
      window.removeEventListener("syaahi:account-updated", sync);
    };
  }, [refresh]);
  const legacy = workspaceScopedPath(path);
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
