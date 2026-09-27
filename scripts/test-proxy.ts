import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
process.env.APP_ROLE = "backend";
process.env.BACKEND_PROXY_SECRET = "test-only-proxy-secret";
assert.equal(
  middleware(new NextRequest("https://backend.test/api/jobs")).status,
  403,
);
assert.equal(
  middleware(
    new NextRequest("https://backend.test/api/jobs", {
      headers: { "x-syaahi-proxy": "test-only-proxy-secret" },
    }),
  ).status,
  200,
);
process.env.APP_ROLE = "frontend";
process.env.VERCEL = "1";
process.env.BACKEND_URL = "https://backend.test";
const page = middleware(new NextRequest("https://frontend.test/login"));
assert.equal(page.headers.get("x-middleware-next"), "1");
assert.equal(page.headers.get("x-middleware-rewrite"), null);
const sitemap = middleware(
  new NextRequest("https://frontend.test/sitemap.xml"),
);
assert.equal(sitemap.headers.get("x-middleware-next"), "1");
assert.equal(sitemap.headers.get("x-middleware-rewrite"), null);
const proxied = middleware(
  new NextRequest("https://frontend.test/api/jobs?status=active", {
    headers: {
      "x-forwarded-for": "192.0.2.2",
      "x-real-ip": "spoofed",
      "x-syaahi-proxy": "spoofed",
    },
  }),
);
assert.equal(
  proxied.headers.get("x-middleware-rewrite"),
  "https://backend.test/api/jobs?status=active",
);
assert.equal(
  proxied.headers.get("x-middleware-request-x-forwarded-for"),
  "192.0.2.2",
);
assert.equal(proxied.headers.get("x-middleware-request-x-real-ip"), null);
assert.equal(
  proxied.headers.get("x-middleware-request-x-syaahi-proxy"),
  "test-only-proxy-secret",
);
delete process.env.VERCEL;
const untrusted = middleware(
  new NextRequest("https://frontend.test/api/jobs", {
    headers: { "x-forwarded-for": "spoofed" },
  }),
);
assert.equal(
  untrusted.headers.get("x-middleware-request-x-forwarded-for"),
  "unknown",
);
delete process.env.BACKEND_PROXY_SECRET;
const publicPageWithoutApiConfig = middleware(
  new NextRequest("https://frontend.test/about"),
);
assert.equal(publicPageWithoutApiConfig.status, 200);
assert.equal(publicPageWithoutApiConfig.headers.get("x-middleware-next"), "1");
assert.equal(
  middleware(new NextRequest("https://frontend.test/api/jobs")).status,
  503,
);
console.log(
  "PASS: Vercel serves pages and sitemap directly; only API routes proxy to protected Render ingress; forged headers are replaced and missing API configuration fails closed.",
);
process.env.VERCEL = "1";
delete process.env.APP_ROLE;
delete process.env.BACKEND_URL;
assert.equal(
  middleware(new NextRequest("https://frontend.test/api/jobs")).status,
  503,
);
