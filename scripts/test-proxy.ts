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
process.env.NETLIFY = "true";
delete process.env.VERCEL;
process.env.BACKEND_URL = "https://backend.test";
const proxied = middleware(
  new NextRequest("https://frontend.test/api/jobs", {
    headers: {
      "x-forwarded-for": "spoofed",
      "x-nf-client-connection-ip": "192.0.2.1",
    },
  }),
);
assert.equal(
  proxied.headers.get("x-middleware-rewrite"),
  "https://backend.test/api/jobs",
);
assert.equal(
  proxied.headers.get("x-middleware-request-x-forwarded-for"),
  "192.0.2.1",
);
assert.equal(
  proxied.headers.get("x-middleware-request-x-syaahi-proxy"),
  "test-only-proxy-secret",
);
process.env.VERCEL = "1";
delete process.env.NETLIFY;
const vercel = middleware(
  new NextRequest("https://frontend.test/api/jobs?status=active", {
    headers: {
      "x-forwarded-for": "192.0.2.2",
      "x-nf-client-connection-ip": "spoofed",
      "x-real-ip": "spoofed",
      "x-syaahi-proxy": "spoofed",
    },
  }),
);
assert.equal(
  vercel.headers.get("x-middleware-request-x-forwarded-for"),
  "192.0.2.2",
);
assert.equal(vercel.headers.get("x-middleware-request-x-real-ip"), null);
assert.equal(
  vercel.headers.get("x-middleware-request-x-syaahi-proxy"),
  "test-only-proxy-secret",
);
assert.equal(
  vercel.headers.get("x-middleware-rewrite"),
  "https://backend.test/api/jobs?status=active",
);
delete process.env.VERCEL;
const untrusted = middleware(
  new NextRequest("https://frontend.test/api/jobs", {
    headers: {
      "x-forwarded-for": "spoofed",
      "x-nf-client-connection-ip": "spoofed",
    },
  }),
);
assert.equal(
  untrusted.headers.get("x-middleware-request-x-forwarded-for"),
  "unknown",
);
delete process.env.BACKEND_PROXY_SECRET;
assert.equal(
  middleware(new NextRequest("https://frontend.test/api/jobs")).status,
  503,
);
console.log(
  "PASS: backend rejects direct access, frontend rewrites only to configured backend, forwarding headers are overwritten, missing configuration fails closed.",
);
