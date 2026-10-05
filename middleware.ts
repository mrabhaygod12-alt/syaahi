import { NextRequest, NextResponse } from "next/server";
import { releaseRevision } from "./lib/release";
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname.toLowerCase();
  const isTrap =
    /(?:^|\/)\.(?:env|git|svn)(?:[/.]|$)/.test(path) ||
    /^\/(?:data|backups|wp-admin|phpmyadmin|cgi-bin)(?:\/|$)/.test(path) ||
    /^\/(?:wp-login\.php|xmlrpc\.php)$/.test(path);
  // Keep one indexable/public origin even if the Vercel alias or apex domain
  // remains attached without a redirect in the hosting dashboard.
  const hostname = req.nextUrl.hostname.toLowerCase();
  if (hostname === "syaahii.in" || hostname === "syaahii.vercel.app") {
    const canonical = req.nextUrl.clone();
    canonical.protocol = "https:";
    canonical.hostname = "www.syaahii.in";
    canonical.port = "";
    return NextResponse.redirect(canonical, 308);
  }

  const role = process.env.APP_ROLE;
  const backend = process.env.BACKEND_URL?.trim();
  const isFrontend =
    role === "frontend" ||
    process.env.VERCEL === "1" ||
    (!!backend && role !== "backend" && role !== "worker");
  const isApiRequest = req.nextUrl.pathname.startsWith("/api/") || isTrap;
  const frontendResponse = (response: NextResponse) => {
    const revision = releaseRevision(process.env.VERCEL_GIT_COMMIT_SHA);
    if (revision) response.headers.set("x-syaahi-frontend-revision", revision);
    return response;
  };

  // Vercel owns and serves every page, static asset, sitemap and robots file.
  // Only same-origin API calls should cross the private proxy to Render.
  if (isFrontend && isApiRequest) {
    const secret = process.env.BACKEND_PROXY_SECRET;
    if (!backend || !secret)
      return NextResponse.json(
        {
          error:
            "The study service is temporarily unavailable. Please try again shortly.",
        },
        { status: 503 },
      );
    let target: URL;
    try {
      const base = new URL(backend);
      if (base.username || base.password || base.hostname === hostname)
        throw new Error("Invalid backend origin");
      target = new URL(
        isTrap
          ? "/api/security/trap"
          : req.nextUrl.pathname + req.nextUrl.search,
        base,
      );
    } catch {
      return NextResponse.json(
        {
          error:
            "The study service is temporarily unavailable. Please try again shortly.",
        },
        { status: 503 },
      );
    }
    if (
      target.protocol !== "https:" &&
      !(
        target.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(target.hostname)
      )
    )
      return NextResponse.json(
        {
          error:
            "The study service is temporarily unavailable. Please try again shortly.",
        },
        { status: 503 },
      );
    const headers = new Headers(req.headers);
    headers.set("x-syaahi-proxy", secret);
    headers.set(
      "x-forwarded-for",
      // Vercel overwrites x-forwarded-for at its trusted ingress.
      (process.env.VERCEL === "1"
        ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        : undefined) || "unknown",
    );
    headers.delete("x-real-ip");
    return frontendResponse(
      NextResponse.rewrite(target, { request: { headers } }),
    );
  }

  if (isFrontend) return frontendResponse(NextResponse.next());

  if (role === "backend" && req.nextUrl.pathname !== "/api/health") {
    const secret = process.env.BACKEND_PROXY_SECRET;
    if (!secret || req.headers.get("x-syaahi-proxy") !== secret)
      return NextResponse.json(
        { error: "Use the application frontend." },
        { status: 403 },
      );
  }
  if (isTrap)
    return NextResponse.rewrite(new URL("/api/security/trap", req.url));
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
