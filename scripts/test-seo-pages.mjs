import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Test the rendered production HTML: metadata inheritance bugs do not show up
// in tests of pageMeta() alone. Run against a local build or the live deployment.
const base = process.env.SEO_TEST_URL || "http://localhost:3100";
const canonicalOrigin = "https://www.syaahii.in";
const buildOnly = process.argv.includes("--build");
async function get(path) {
  if (buildOnly) {
    const file =
      path === "/"
        ? "index.html"
        : /\.(xml|txt)$/.test(path)
          ? `${path.slice(1)}.body`
          : `${path.slice(1)}.html`;
    return {
      response: { status: 200, headers: new Headers() },
      html: await readFile(`.next/server/app/${file}`, "utf8"),
    };
  }
  const response = await fetch(new URL(path, base), {
    headers: { "User-Agent": "Googlebot" },
    signal: AbortSignal.timeout(30000),
    redirect: "manual",
  });
  return { response, html: await response.text() };
}
const { response, html: xml } = await get("/sitemap.xml");
assert.equal(response.status, 200);
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
assert(urls.length > 20);
assert.equal(new Set(urls).size, urls.length, "Sitemap contains duplicates");
const titles = new Set();
const skipped = [];
for (const url of urls) {
  assert.equal(new URL(url).origin, canonicalOrigin);
  if (buildOnly && new URL(url).pathname === "/pricing") {
    skipped.push(url);
    continue;
  }
  const { response, html } = await get(new URL(url).pathname);
  assert.equal(response.status, 200, url);
  assert(!response.headers.get("x-robots-tag")?.includes("noindex"), url);
  const tags = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
  const canonical = tags.filter((tag) => /rel="canonical"/.test(tag));
  assert.equal(canonical.length, 1, `Expected one canonical: ${url}`);
  assert.equal(
    new URL(canonical[0].match(/href="([^"]+)"/)?.[1]).href,
    new URL(url).href,
    `Wrong canonical: ${url}`,
  );
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  assert(
    title && !title.includes("| Syaahi | Syaahi"),
    `Invalid title: ${url}`,
  );
  assert(!titles.has(title), `Duplicate title: ${url}`);
  titles.add(title);
  assert(
    /<meta name="description" content="[^"]+"/.test(html),
    `Missing description: ${url}`,
  );
  assert(
    !/<meta name="robots"[^>]*noindex/.test(html),
    `Public page noindex: ${url}`,
  );
  assert.equal(
    [...html.matchAll(/<h1\b/g)].length,
    1,
    `Expected one H1: ${url}`,
  );
  assert(html.includes('property="og:image"'), `Missing share image: ${url}`);
}
for (const path of [
  "/login",
  "/signup",
  "/verify-email",
  "/pay",
  "/refer",
  "/payments",
  "/admin/payments",
]) {
  const { html } = await get(path);
  assert(
    /<meta name="robots"[^>]*noindex/.test(html),
    `Private route indexable: ${path}`,
  );
}
const { html: robots } = await get("/robots.txt");
assert(robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`));
const { html: home } = await get("/");
const schemas = [
  ...home.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs),
].map((m) => JSON.parse(m[1]));
assert(
  schemas.some(
    (s) => s["@type"] === "WebSite" && s.alternateName.includes("syaahii.in"),
  ),
);
assert(schemas.some((s) => s["@type"] === "WebApplication"));
console.log(
  buildOnly
    ? `PASS: ${urls.length - skipped.length} built public HTML pages have unique titles, self-canonicals, descriptions, share images and one H1. Private routes are noindex; brand schemas parse. HTTP behavior and dynamic pricing require the live test.`
    : `PASS: ${urls.length} sitemap pages return 200 with unique titles, self-canonicals, descriptions, share images and one H1. Private routes are noindex; brand schemas parse.`,
);
