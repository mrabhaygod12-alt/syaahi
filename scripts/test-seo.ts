import assert from "node:assert/strict";
import { NextRequest } from "next/server";

async function main() {
  process.env.NEXT_PUBLIC_APP_URL = "https://www.syaahii.in";
  const { middleware } = await import("../middleware");
  for (const host of ["https://syaahii.in", "https://syaahii.vercel.app"]) {
    const response = middleware(
      new NextRequest(`${host}/subjects/physics?utm_source=old-domain`),
    );
    assert.equal(response.status, 308);
    assert.equal(
      response.headers.get("location"),
      "https://www.syaahii.in/subjects/physics?utm_source=old-domain",
    );
  }

  const [{ default: sitemap }, { GET: llms }] = await Promise.all([
    import("../app/sitemap"),
    import("../app/llms.txt/route"),
  ]);
  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);
  assert(urls.includes("https://www.syaahii.in/"));
  assert(urls.includes("https://www.syaahii.in/subjects/physics"));
  assert(!urls.some((url) => /\/(login|signup|forgot-password)$/.test(url)));

  const facts = await (await llms()).text();
  assert(facts.includes("19 welcome credits after email verification"));
  assert(facts.includes("https://www.syaahii.in/how-it-works"));
  assert(!facts.includes("/dashboard"));
  console.log(
    "PASS: apex and Vercel aliases permanently redirect; sitemap stays canonical and excludes noindex auth pages; llms.txt lists public pages and current credit facts.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
