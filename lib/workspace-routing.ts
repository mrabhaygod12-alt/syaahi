export type Workspace = "student" | "writer";
export const workspaceHome = (workspace: Workspace) =>
  workspace === "writer" ? "/writer/welcome" : "/dashboard";
export const publishingPath = (path: string) =>
  /^\/(writing|community|creators|guides)(\/|$)/.test(path);
export const studentPath = (path: string) =>
  !/^\/presentations\/(shared|audience)(\/|\?|$)/.test(path) &&
  /^\/(dashboard|generate|lesson|presentations|interview|refer)(\/|$)/.test(
    path,
  );
export const workspaceScopedPath = (path: string) =>
  studentPath(path) ||
  /^\/(pricing|support|profile|account\/billing|subscribe|payments|pay|checkout|reading)(\/|$)/.test(
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
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return home;
  const url = new URL(value, "https://syaahi.local");
  if (url.origin !== "https://syaahi.local") return home;
  // Reject encoded separators as well as literal ones. Decode ordinary path
  // characters before classifying so an encoded workspace name cannot bypass it.
  let path: string;
  try {
    if (/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(url.pathname)) return home;
    path = decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";
    if (/[\\\u0000-\u001f\u007f]/.test(path) || path.startsWith("//"))
      return home;
  } catch {
    return home;
  }
  if (workspace === "writer") {
    if (studentPath(path)) return home;
    if (/^\/checkout(\/|$)/.test(path)) return "/writer/membership";
    const mapped: Record<string, string> = {
      "/pricing": "/writer/membership",
      "/support": "/writer/support",
      "/profile": "/writer/settings",
      "/account/billing": "/writer/billing",
      "/payments": "/writer/payments",
      "/pay": "/writer/billing",
      "/reading": "/writer/reading",
    };
    if (mapped[path]) return mapped[path] + url.search + url.hash;
    if (/^\/(subscribe|payments)\//.test(path))
      return "/writer" + path + url.search + url.hash;
  } else if (/^\/(writer|write)(\/|$)/.test(path)) return home;
  return path + url.search + url.hash;
}
