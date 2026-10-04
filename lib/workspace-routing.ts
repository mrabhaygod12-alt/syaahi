export type Workspace = "student" | "writer";
export const workspaceHome = (workspace: Workspace) =>
  workspace === "writer" ? "/writer/welcome" : "/dashboard";
export const publishingPath = (path: string) =>
  /^\/(writing|community|creators|guides)(\/|$)/.test(path);
export const studentPath = (path: string) =>
  /^\/(dashboard|generate|lesson|presentations|interview|refer)(\/|$)/.test(
    path,
  );
export function workspaceDestination(
  value: string | null | undefined,
  workspace: Workspace,
) {
  const home = workspaceHome(workspace);
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return home;
  const url = new URL(value, "https://syaahi.local");
  if (url.origin !== "https://syaahi.local") return home;
  const path = url.pathname;
  if (workspace === "writer") {
    if (studentPath(path)) return home;
    const mapped: Record<string, string> = {
      "/pricing": "/writer/membership",
      "/support": "/writer/support",
      "/profile": "/writer/settings",
      "/account/billing": "/writer/billing",
      "/payments": "/writer/payments",
      "/pay": "/writer/billing",
    };
    if (mapped[path]) return mapped[path] + url.search + url.hash;
    if (/^\/(subscribe|payments)\//.test(path))
      return "/writer" + path + url.search + url.hash;
  } else if (/^\/(writer|write)(\/|$)/.test(path)) return home;
  return path + url.search + url.hash;
}
