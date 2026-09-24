import { NextRequest, NextResponse } from "next/server";
export function middleware(req: NextRequest) {
  const role = process.env.APP_ROLE;
  if (role === "frontend") {
    const backend = process.env.BACKEND_URL,
      secret = process.env.BACKEND_PROXY_SECRET;
    if (!backend || !secret)
      return NextResponse.json(
        { error: "The study backend is not connected yet." },
        { status: 503 },
      );
    const target = new URL(req.nextUrl.pathname + req.nextUrl.search, backend);
    if (
      target.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(target.hostname)
    )
      return NextResponse.json(
        { error: "Backend must use HTTPS." },
        { status: 503 },
      );
    const headers = new Headers(req.headers);
    headers.set("x-syaahi-proxy", secret);
    headers.set(
      "x-forwarded-for",
      req.headers.get("x-nf-client-connection-ip") || "unknown",
    );
    headers.delete("x-real-ip");
    return NextResponse.rewrite(target, { request: { headers } });
  }
  if (role === "backend" && req.nextUrl.pathname !== "/api/health") {
    const secret = process.env.BACKEND_PROXY_SECRET;
    if (!secret || req.headers.get("x-syaahi-proxy") !== secret)
      return NextResponse.json(
        { error: "Use the application frontend." },
        { status: 403 },
      );
  }
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
